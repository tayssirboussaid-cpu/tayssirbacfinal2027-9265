import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Users, AlertTriangle, RotateCw } from "lucide-react";
import {
  distributeCommittee,
  getLegacyWindow,
  installManualAllocation,
  readEligibleSeries,
  readSnapshot,
  saveManualCommittee,
  type ManualCommittee,
  type Series,
  type Snapshot,
} from "../lib/legacy-manual-bridge";

const css = `
  #manual-distribution-root { direction:rtl; font-family:Tajawal,Cairo,system-ui,sans-serif; margin:0 0 24px; color:#f8fafc; }
  #manual-distribution-root * {box-sizing:border-box}
  .md-shell {background:#1e293b; border:1px solid rgba(56,189,248,.3);border-radius:20px;overflow:hidden;box-shadow:0 15px 35px rgba(0,0,0,.17)}
  .md-top {padding:21px 23px;background:linear-gradient(105deg,#12243a,#1e293b 70%);border-bottom:1px solid rgba(255,255,255,.08);display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
  .md-top h2 {margin:0;font-size:19px;font-weight:850}.md-top p{margin:5px 0 0;color:#94a3b8;font-size:12px;line-height:1.7}
  .md-pill {display:inline-flex;align-items:center;gap:6px;padding:6px 11px;border:1px solid rgba(56,189,248,.24);border-radius:100px;background:rgba(56,189,248,.1);color:#7dd3fc;font-size:11px;font-weight:700}
  .md-layout {display:grid;grid-template-columns:minmax(220px,25%) minmax(0,1fr);min-height:400px}
  .md-committees {border-left:1px solid rgba(255,255,255,.08);padding:15px;max-height:680px;overflow:auto;background:#192536}
  .md-search {width:100%;padding:11px 12px;background:#0f172a;border:1px solid rgba(255,255,255,.12);border-radius:11px;color:#fff;outline:none;font:inherit;font-size:12px}
  .md-list {display:grid;gap:5px;margin-top:12px}.md-committee {width:100%;text-align:right;background:transparent;color:#cbd5e1;border:1px solid transparent;border-radius:11px;padding:10px;cursor:pointer;font:inherit}
  .md-committee:hover{background:rgba(255,255,255,.05)}.md-committee.active{background:rgba(56,189,248,.1);border-color:rgba(56,189,248,.35);color:#fff}
  .md-committee strong{display:block;font-size:12px}.md-committee span{display:block;color:#94a3b8;font-size:10px;margin-top:4px}
  .md-work {padding:19px;min-width:0}.md-workhead{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:15px}
  .md-workhead h3{font-size:15px;margin:0}.md-sub{color:#94a3b8;font-size:11px;margin-top:5px}.md-metrics{display:flex;gap:6px;flex-wrap:wrap;margin:14px 0}
  .md-metric{border:1px solid rgba(255,255,255,.1);background:#0f172a;border-radius:10px;padding:8px 12px;font-size:11px;color:#94a3b8}.md-metric b{color:#7dd3fc;font-size:14px;margin-left:5px}
  .md-observers{display:grid;grid-template-columns:repeat(auto-fit,minmax(215px,1fr));gap:9px;margin:13px 0 19px}
  .md-observer{background:#172536;border:1px solid rgba(255,255,255,.1);border-radius:13px;padding:12px;min-width:0}
  .md-observer.active{border-color:#38bdf8;background:#173149}.md-observer button{font:inherit;cursor:pointer}
  .md-observer-select{background:transparent;color:#f8fafc;border:0;text-align:right;width:100%;font-size:12px;font-weight:800;padding:0}
  .md-observer-bottom{display:flex;justify-content:space-between;align-items:center;gap:5px;margin-top:10px;color:#94a3b8;font-size:10px}
  .md-capacity{width:62px;background:#0f172a;color:#fff;border:1px solid rgba(255,255,255,.2);border-radius:8px;padding:5px;text-align:center;font:inherit}
  .md-sectiontitle{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center;font-size:12px;font-weight:800;margin-bottom:10px}
  .md-group{border:1px solid rgba(255,255,255,.09);border-radius:12px;margin-bottom:8px;overflow:hidden}.md-group summary{padding:10px 12px;cursor:pointer;background:#172536;font-weight:700;font-size:12px;list-style:none;display:flex;justify-content:space-between}.md-group summary::-webkit-details-marker{display:none}
  .md-series-list{max-height:270px;overflow:auto;padding:5px 10px}.md-series{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 2px;border-bottom:1px solid rgba(255,255,255,.055);font-size:11px;cursor:pointer}.md-series:last-child{border-bottom:0}.md-series input{accent-color:#38bdf8;width:16px;height:16px}.md-series span{color:#94a3b8}.md-series.disabled{opacity:.46;cursor:not-allowed}
  .md-footer{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:9px;border-top:1px solid rgba(255,255,255,.08);margin-top:17px;padding-top:15px;font-size:11px;color:#94a3b8}
  .md-action{background:#38bdf8;color:#0f172a;border:0;border-radius:10px;padding:10px 14px;font:inherit;font-size:12px;font-weight:800;cursor:pointer}.md-action:hover{background:#7dd3fc}.md-action:disabled{opacity:.5;cursor:not-allowed}
  .md-notice{display:block;padding:10px 12px;border-radius:10px;font-size:11px;line-height:1.6;margin:12px 0}.md-notice.warn{background:rgba(245,158,11,.11);color:#fcd34d;border:1px solid rgba(245,158,11,.2)}.md-notice.success{background:rgba(16,185,129,.11);color:#6ee7b7;border:1px solid rgba(16,185,129,.2)}
  @media(max-width:840px){.md-layout{grid-template-columns:1fr}.md-committees{border-left:0;border-bottom:1px solid rgba(255,255,255,.08);max-height:180px}.md-list{grid-template-columns:repeat(auto-fit,minmax(180px,1fr))}}
`;

type Props = { frame: HTMLIFrameElement; snapshot: Snapshot };

export function ManualDistribution({ frame, snapshot }: Props) {
  const [committeeId, setCommitteeId] = useState<number>(snapshot.committees[0]?.id || 1);
  const [teacherId, setTeacherId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState<{ kind: "warn" | "success"; text: string } | null>(null);
  const committee = snapshot.committees.find((c) => c.id === committeeId);
  const observers = snapshot.teachers.filter((t) => +t.committee_id === committeeId);
  const chosenTeacher = observers.find((t) => t.id === teacherId) || observers[0];
  const available = readEligibleSeries(frame, committeeId);
  const saved = snapshot.manual[committeeId] || { capacities: {}, assignments: {} };
  const assigned = Object.entries(saved.assignments).filter(
    ([sid, tid]) =>
      available.some((s) => String(s.id) === sid) && observers.some((t) => +t.id === +tid),
  );
  const totalCandidates = available.reduce((n, s) => n + (Number(s.total) || 0), 0);
  const groups = snapshot.branches
    .filter((b) => committee?.branch_ids.includes(b.id))
    .map((b) => ({ branch: b, items: available.filter((s) => +s.section_id === b.id) }))
    .filter((g) => g.items.length);

  const update = (next: ManualCommittee, text: string) => {
    saveManualCommittee(frame, committeeId, next);
    setMessage({ kind: "success", text });
    // The parent reloads the application snapshot after this custom event.
    frame.dispatchEvent(new Event("manual-data-change"));
  };

  const setCapacity = (id: number, value: number) => {
    const capacity = Math.max(0, Math.min(available.length, Math.floor(value || 0)));
    const current = Object.values(saved.assignments).filter((tid) => +tid === id).length;
    if (capacity < current) {
      setMessage({
        kind: "warn",
        text: `ألغِ إسناد ${current - capacity} سلسلة أولًا قبل تقليص العدد.`,
      });
      return;
    }
    update(
      {
        capacities: { ...saved.capacities, [id]: capacity },
        assignments: { ...saved.assignments },
      },
      "تم حفظ العدد المحدد للمراقب.",
    );
  };

  const toggleSeries = (item: Series) => {
    if (!chosenTeacher) return;
    const current = saved.assignments[item.id];
    const next = { ...saved.assignments };
    if (+current === chosenTeacher.id) delete next[item.id];
    else {
      if (current) {
        setMessage({ kind: "warn", text: "هذه السلسلة مسندة لمراقب آخر داخل اللجنة." });
        return;
      }
      if (!chosenTeacher.eligibleBranches.includes(+item.section_id)) {
        setMessage({ kind: "warn", text: "المراقب غير معني بهذه الشعبة." });
        return;
      }
      const capacity = Number(saved.capacities[chosenTeacher.id]) || 0;
      const count = Object.values(next).filter((id) => +id === chosenTeacher.id).length;
      if (count >= capacity) {
        setMessage({ kind: "warn", text: "حدد عدد السلاسل لهذا المراقب أو زد العدد قبل الإسناد." });
        return;
      }
      next[item.id] = chosenTeacher.id;
    }
    update(
      { capacities: { ...saved.capacities }, assignments: next },
      "تم حفظ اختيار السلاسل. أعد تشغيل التوزيع الأولي لتحديث المصححين.",
    );
  };

  const run = () => {
    const error = distributeCommittee(frame, committeeId);
    if (error) setMessage({ kind: "warn", text: error });
    else {
      setMessage({
        kind: "success",
        text: "تم توزيع السلاسل المتبقية على المصححين بعد عزل سلاسل المراقبين.",
      });
      frame.dispatchEvent(new Event("manual-data-change"));
    }
  };

  return (
    <div className="md-shell">
      <header className="md-top">
        <div>
          <span className="md-pill">
            <Users size={13} /> توزيع يدوي
          </span>
          <h2>توزيع السلاسل على المراقبين</h2>
          <p>
            حدد العدد لكل مراقب واختر سلاسله بنفسك؛ تُستبعد تلقائيًا من التوزيع العادل على المصححين في
            اللجنة.
          </p>
        </div>
        <span className="md-pill">{snapshot.committees.length} لجنة إصلاح</span>
      </header>
      <div className="md-layout">
        <aside className="md-committees">
          <input
            className="md-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث عن لجنة إصلاح..."
            aria-label="البحث عن لجنة"
          />
          <div className="md-list">
            {snapshot.committees
              .filter((c) => `${c.id} ${c.name}`.includes(search))
              .map((c) => {
                const count = snapshot.teachers.filter((t) => +t.committee_id === c.id).length;
                return (
                  <button
                    key={c.id}
                    className={`md-committee ${c.id === committeeId ? "active" : ""}`}
                    onClick={() => {
                      setCommitteeId(c.id);
                      setTeacherId(null);
                      setMessage(null);
                    }}
                  >
                    <strong>
                      {c.id}. {c.name}
                    </strong>
                    <span>
                      {count} مراقب ·{" "}
                      {count
                        ? snapshot.teachers
                            .filter((t) => +t.committee_id === c.id)
                            .map((t) => t.name)
                            .join("، ")
                        : "لا يوجد مراقبون"}
                    </span>
                  </button>
                );
              })}
          </div>
        </aside>
        <section className="md-work">
          <div className="md-workhead">
            <div>
              <h3>{committee?.name || "اللجنة"}</h3>
              <div className="md-sub">
                الشعب المعنية:{" "}
                {snapshot.branches
                  .filter((b) => committee?.branch_ids.includes(b.id))
                  .map((b) => b.name)
                  .join("، ") || "—"}
              </div>
            </div>
            <span className="md-pill">
              <RotateCw size={13} /> حفظ تلقائي
            </span>
          </div>
          <div className="md-metrics">
            <span className="md-metric">
              <b>{observers.length}</b> مراقب
            </span>
            <span className="md-metric">
              <b>{available.length}</b> سلسلة مؤهلة
            </span>
            <span className="md-metric">
              <b>{totalCandidates}</b> مترشح
            </span>
            <span className="md-metric">
              <b>{assigned.length}</b> سلسلة للمراقبين
            </span>
            <span className="md-metric">
              <b>{available.length - assigned.length}</b> للمصححين
            </span>
          </div>
          {!observers.length && (
            <div className="md-notice warn">
              <AlertTriangle size={13} style={{ display: "inline", verticalAlign: "middle" }} /> لا
              يوجد مراقبون مسجلون في هذه اللجنة. أضفهم من قائمة الأساتذة المصححين ثم ارجع هنا.
            </div>
          )}
          {!available.length && (
            <div className="md-notice warn">
              لا توجد سلاسل مسجلة للشعب المعنية بهذه اللجنة. استورد بيانات السلاسل من محور إدارة
              السلاسل.
            </div>
          )}
          {!!observers.length && (
            <>
              <div className="md-sectiontitle">المراقبون — اختر مراقبًا وحدد عدد السلاسل له</div>
              <div className="md-observers">
                {observers.map((t) => {
                  const count = assigned.filter(([, tid]) => +tid === t.id).length;
                  const candidates = available
                    .filter((s) => +saved.assignments[s.id] === t.id)
                    .reduce((n, s) => n + (Number(s.total) || 0), 0);
                  return (
                    <div
                      className={`md-observer ${chosenTeacher?.id === t.id ? "active" : ""}`}
                      key={t.id}
                    >
                      <button
                        className="md-observer-select"
                        onClick={() => {
                          setTeacherId(t.id);
                          setMessage(null);
                        }}
                      >
                        {chosenTeacher?.id === t.id ? "◉" : "○"} {t.name}
                      </button>
                      <div className="md-sub">
                        {t.workplace || "مراقب"} ·{" "}
                        {t.eligibleBranches
                          .map((id) => snapshot.branches.find((b) => b.id === id)?.name)
                          .filter(Boolean)
                          .join("، ") || "لا شعب محددة"}
                      </div>
                      <div className="md-observer-bottom">
                        <label>
                          عدد السلاسل{" "}
                          <input
                            aria-label={`عدد سلاسل ${t.name}`}
                            className="md-capacity"
                            type="number"
                            min="0"
                            max={available.length}
                            value={saved.capacities[t.id] ?? 0}
                            onChange={(e) => setCapacity(t.id, Number(e.target.value))}
                          />
                        </label>
                        <span>
                          {count} / {saved.capacities[t.id] || 0} · {candidates} مترشح
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          {!!chosenTeacher && (
            <>
              <div className="md-sectiontitle">
                <span>السلاسل حسب الشعبة — {chosenTeacher.name}</span>
                <span className="md-sub">اختر السلاسل المؤهلة لهذا المراقب فقط</span>
              </div>
              {groups.map(({ branch, items }) => (
                <details className="md-group" key={branch.id} open>
                  <summary>
                    <span>{branch.name}</span>
                    <span>
                      {items.length} سلسلة · {items.reduce((n, s) => n + (Number(s.total) || 0), 0)}{" "}
                      مترشح
                    </span>
                  </summary>
                  <div className="md-series-list">
                    {items.map((s) => {
                      const owner = saved.assignments[s.id];
                      const eligible = chosenTeacher.eligibleBranches.includes(+s.section_id);
                      const locked = !!owner && +owner !== chosenTeacher.id;
                      const disabled = !eligible || locked;
                      const ownerName = locked
                        ? observers.find((t) => +t.id === +owner)?.name
                        : null;
                      return (
                        <label className={`md-series ${disabled ? "disabled" : ""}`} key={s.id}>
                          <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
                            <input
                              type="checkbox"
                                  aria-label={`إسناد سلسلة ${s.numero || s.number || s.num || s.code || s.id} إلى ${chosenTeacher.name}`}
                              checked={+owner === chosenTeacher.id}
                              disabled={disabled}
                              onChange={() => toggleSeries(s)}
                            />
                            <strong>سلسلة {s.numero || s.number || s.num || s.code || `#${s.id}`}</strong>
                            <span>#{s.id}</span>
                          </span>
                          <span>
                            {Number(s.total) || 0} مترشح{" "}
                            {locked
                              ? `· مسندة إلى ${ownerName || "مراقب آخر"}`
                              : !eligible
                                ? "· غير مؤهل"
                                : ""}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </details>
              ))}
            </>
          )}
          {message && (
            <output className={`md-notice ${message.kind}`}>
              {message.kind === "success" ? (
                <Check size={13} style={{ display: "inline", verticalAlign: "middle" }} />
              ) : (
                <AlertTriangle size={13} style={{ display: "inline", verticalAlign: "middle" }} />
              )}{" "}
              {message.text}
            </output>
          )}
          <div className="md-footer">
            <span>
              لا يتم إسناد أي سلسلة للمراقبين آليًا. الاختيارات اليدوية المحفوظة فقط هي المعتمدة.
            </span>
            <button className="md-action" onClick={run} disabled={!available.length}>
              توزيع المتبقي على المصححين
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

export function LegacyManualApp() {
  const [frame, setFrame] = useState<HTMLIFrameElement | null>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!frame) return;
    const win = getLegacyWindow(frame);
    if (!win) return;
    if (!installManualAllocation(frame)) {
      setError("تعذر تهيئة محرك التوزيع في الملف المرفق.");
      return;
    }
    const doc = frame.contentDocument;
    if (!doc) return;
    const style = doc.createElement("style");
    style.textContent = css;
    doc.head.appendChild(style);
    let raf = 0;
    const sync = () => {
      try {
        const current = readSnapshot(frame);
        if (current)
          setSnapshot((previous) =>
            JSON.stringify(previous) === JSON.stringify(current) ? previous : current,
          );
        const visible = win.eval(`typeof sidebar !== 'undefined' && sidebar === 'dist'`) as boolean;
        const main = doc.getElementById("mainContent");
        if (visible && main) {
          let target = doc.getElementById("manual-distribution-root");
          if (!target) {
            target = doc.createElement("div");
            target.id = "manual-distribution-root";
            main.prepend(target);
          }
          setHost((previous) => (previous === target ? previous : target));
        } else setHost(null);
      } catch (e) {
        console.error(e);
      }
    };
    const schedule = () => {
      if (!raf)
        raf = win.requestAnimationFrame(() => {
          raf = 0;
          sync();
        });
    };
    const observer = new MutationObserver(schedule);
    observer.observe(doc.body, { childList: true, subtree: true });
    doc.addEventListener("click", schedule);
    frame.addEventListener("manual-data-change", schedule);
    sync();
    return () => {
      observer.disconnect();
      doc.removeEventListener("click", schedule);
      frame.removeEventListener("manual-data-change", schedule);
      win.cancelAnimationFrame(raf);
      style.remove();
      setHost(null);
    };
  }, [frame]);

  return (
    <div style={{ width: "100%", height: "100dvh", background: "#0f172a" }}>
      <iframe
        title="TAYSSIR-BAC — نظام إدارة الباكالوريا"
        src="/legacy/tayssir-original.html"
        onLoad={(e) => setFrame(e.currentTarget)}
        style={{ border: 0, width: "100%", height: "100%", display: "block" }}
      />
      {error && (
        <div
          style={{
            position: "fixed",
            bottom: 20,
            left: 20,
            background: "#7f1d1d",
            color: "white",
            padding: 12,
            borderRadius: 10,
          }}
        >
          {error}
        </div>
      )}
      {host &&
        snapshot &&
        createPortal(<ManualDistribution frame={frame!} snapshot={snapshot} />, host)}
    </div>
  );
}
