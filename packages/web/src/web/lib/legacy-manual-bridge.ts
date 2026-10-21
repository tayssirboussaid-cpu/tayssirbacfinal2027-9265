// Integration adapter for the user-supplied TAYSSIR-BAC document. The existing
// application remains intact; only its V20 supervisor allocation is replaced.
export type Branch = { id: number; name: string };
export type Series = {
  id: number;
  section_id: number;
  total: number;
  numero?: string;
  number?: string;
  num?: string;
  code?: string;
};
export type Teacher = {
  id: number;
  name: string;
  role: string;
  committee_id: number;
  workplace?: string;
  eligibleBranches: number[];
};
export type Committee = { id: number; name: string; branch_ids: number[] };
export type ManualCommittee = {
  capacities: Record<string, number>;
  assignments: Record<string, number>;
};
export type Snapshot = {
  committees: Committee[];
  branches: Branch[];
  teachers: Teacher[];
  series: Series[];
  manual: Record<string, ManualCommittee>;
  results: Record<string, { totalSeries: number; stats?: { fairnessScore: number } }>;
};

type LegacyWindow = Window & { eval: (script: string) => unknown; __manualInstalled?: boolean };

export function getLegacyWindow(frame: HTMLIFrameElement): LegacyWindow | null {
  try {
    return frame.contentWindow as LegacyWindow | null;
  } catch {
    return null;
  }
}

export function installManualAllocation(frame: HTMLIFrameElement): boolean {
  const win = getLegacyWindow(frame);
  if (!win || win.__manualInstalled) return !!win?.__manualInstalled;
  try {
    // Execute inside the original application's realm to reuse its eligibility,
    // persistence, branch splitting, and fair corrector-allocation functions.
    win.eval(`(function(){
      if (window.__manualInstalled) return;
      if (typeof distributionV20 === 'undefined' || typeof assignSupervisorsV20 !== 'function') return;
      distributionV20.manualSupervisors = distributionV20.manualSupervisors || {};
      const originalRun = runInitialDistributionV20;
      const originalClear = clearDistributionV20;
      const originalSeriesForCommittee = getSeriesForCommitteeV20;
      // Optional-subject series carry their own candidate counts in opts, not total.
      // Preserve the existing 50/50 committee split and only refine eligibility.
      window.getSeriesForCommitteeV20 = function(cid){
        const committee = getCommitteeByIdStrict(cid);
        const base = originalSeriesForCommittee(cid);
        if(!committee) return base;
        if(committee.isOptional && committee.subjectCode)
          return base.filter(s=>Number(s.opts?.[committee.subjectCode])>0)
            .map(s=>({...s,total:Number(s.opts[committee.subjectCode])||0}));
        const special = {14:{branch:7,code:'INFO'},15:{branch:7,code:'HIST'},9:{branch:1,code:'MATH'},17:{branch:1,code:'BIO'}}[cid];
        if(!special) return base;
        return base.flatMap(s=>{
          if(+s.section_id!==special.branch) return [s];
          const count=Number(s.opts?.[special.code])||0;
          return count>0?[{...s,total:count}]:[];
        });
      };
      window.runInitialDistributionV20 = function(committeeId){
        const ids = committeeId ? [+committeeId] : getCommitteesListV20().map(c=>c.id);
        const results = {};
        ids.forEach(cid=>{
          window.__manualCommitteeForRun = cid;
          try { Object.assign(results, originalRun(cid)); }
          finally { delete window.__manualCommitteeForRun; }
        });
        return results;
      };
      window.assignSupervisorsV20 = function(seriesList, supervisors){
        const cid = window.__manualCommitteeForRun;
        const selection = distributionV20.manualSupervisors?.[cid] || {};
        const requested = selection.assignments || {};
        const capacities = selection.capacities || {};
        const assignments = {}, capacity = {}, details = [];
        const assignedIds = new Set();
        supervisors.forEach(s=>{
          capacity[s.id] = {count:0,total:0,series:[]};
          details.push({supervisorId:s.id,name:s.name,workplace:s.workplace||'',series:[],totalCandidates:0,count:0});
        });
        seriesList.forEach(ser=>{
          const supervisor = supervisors.find(s=>+s.id===+requested[ser.id]);
          if(!supervisor) return;
          const limit = Math.max(0, Math.floor(Number(capacities[supervisor.id])||0));
          if(capacity[supervisor.id].count>=limit || !getEligibleTeachersForSeriesV20(ser,[supervisor]).length) return;
          const total = Number(ser.total)||0;
          capacity[supervisor.id].count++;
          capacity[supervisor.id].total+=total;
          capacity[supervisor.id].series.push(ser.id);
          const detail = details.find(d=>d.supervisorId===supervisor.id);
          detail.series.push(ser.id); detail.totalCandidates+=total; detail.count++;
          assignments[ser.id]=supervisor.id; assignedIds.add(ser.id);
        });
        return {assignments,details,capacity,remaining:seriesList.filter(s=>!assignedIds.has(s.id))};
      };
      window.clearDistributionV20 = function(){ originalClear(); distributionV20.manualSupervisors={}; saveDistributionV20(); };
      window.__manualInstalled = true;
    })()`);
    return !!win.__manualInstalled;
  } catch (error) {
    console.error("Manual distribution integration failed", error);
    return false;
  }
}

export function readSnapshot(frame: HTMLIFrameElement): Snapshot | null {
  const win = getLegacyWindow(frame);
  if (!win?.__manualInstalled) return null;
  try {
    const json = win.eval(`JSON.stringify({
      committees:getCommitteesListV20().map(c=>({id:c.id,name:c.name,branch_ids:c.branch_ids||[]})),
      branches:branches.map(b=>({id:b.id,name:b.name})),
      teachers:teachers.filter(t=>t.role==='مراقب').map(t=>({id:t.id,name:t.name,role:t.role,committee_id:t.committee_id,workplace:t.workplace||'',eligibleBranches:getActiveDistributionBranches(t)})),
      series:series.map(s=>({id:s.id,section_id:s.section_id,total:s.total,numero:s.numero,number:s.number,num:s.num,code:s.code})),
      manual:distributionV20.manualSupervisors||{},
      results:Object.fromEntries(Object.entries(distributionV20.initial||{}).map(([key,value])=>[key,{totalSeries:value.totalSeries,stats:value.stats}]))
    })`) as string;
    return JSON.parse(json) as Snapshot;
  } catch (error) {
    console.error("Could not read TAYSSIR data", error);
    return null;
  }
}

export function readEligibleSeries(frame: HTMLIFrameElement, committeeId: number): Series[] {
  const win = getLegacyWindow(frame);
  if (!win) return [];
  try {
    return JSON.parse(
      win.eval(
      `JSON.stringify(getSeriesForCommitteeV20(${Number(committeeId)}).map(s=>({id:s.id,section_id:s.section_id,total:s.total,numero:s.numero,number:s.number,num:s.num,code:s.code})))`,
      ) as string,
    ) as Series[];
  } catch {
    return [];
  }
}

export function saveManualCommittee(
  frame: HTMLIFrameElement,
  committeeId: number,
  data: ManualCommittee,
): void {
  const win = getLegacyWindow(frame);
  if (!win) return;
  const id = Number(committeeId);
  const encoded = JSON.stringify(data);
  win.eval(`(function(){
    distributionV20.manualSupervisors=distributionV20.manualSupervisors||{};
    distributionV20.manualSupervisors[${id}]=${encoded};
    delete distributionV20.initial[${id}];
    delete distributionV20.second[${id}];
    delete distributionV20.final[${id}];
    saveDistributionV20();
  })()`);
}

export function distributeCommittee(frame: HTMLIFrameElement, committeeId: number): string | null {
  const win = getLegacyWindow(frame);
  if (!win) return "تعذر الوصول إلى المحرك";
  try {
    const result = win.eval(`runInitialDistributionV20(${Number(committeeId)})`) as Record<
      string,
      { error?: string }
    >;
    const error = result?.[committeeId]?.error;
    if (!error) win.eval(`renderSingleCommitteeDist(document.getElementById('mainContent'))`);
    return error || null;
  } catch (error) {
    return String(error);
  }
}
