import type { AppDef } from "@/lib/apps";

export function AppStub({ app }: { app: AppDef }) {
  return (
    <div className="stub">
      <div className="stub-icon">{app.icon}</div>
      <div className="stub-title">{app.name}</div>
      <div className="stub-tag">In design</div>
      <div className="stub-desc">{app.description}</div>
      <div className="stub-tbd">
        {"// TBD — we'll design this one next, in conversation"}
      </div>
    </div>
  );
}
