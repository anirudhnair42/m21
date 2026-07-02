"use client";

import { IosIcon } from "@/components/mobile/IosIcon";
import { IOS_GLYPHS } from "@/components/mobile/IosGlyphs";
import {
  IOS_APPS,
  IOS_DECOR,
  type IosAppId,
} from "@/components/mobile/iosApps";

type Props = {
  mailUnread: number;
  onLaunch: (id: IosAppId, rect: DOMRect) => void;
};

/** iOS 11 home screen: wallpaper + app grid + page dots + frosted dock. */
export function Springboard({ mailUnread, onLaunch }: Props) {
  const gridApps = IOS_APPS.filter((a) => a.placement === "grid");
  const dockApps = IOS_APPS.filter((a) => a.placement === "dock");

  return (
    <div className="ios-springboard">
      <div className="ios-sb-wallpaper" />

      <div className="ios-grid">
        {gridApps.map((a) => (
          <div className="ios-grid-cell" key={a.id}>
            <IosIcon
              label={a.label}
              icon={a.icon}
              tint={a.tint}
              glyph={IOS_GLYPHS[a.label]}
              onClick={(rect) => onLaunch(a.id, rect)}
            />
            {a.id === "mail" && mailUnread > 0 && (
              <span className="ios-icon-badge">{mailUnread}</span>
            )}
          </div>
        ))}
        {IOS_DECOR.map((d) => (
          <div className="ios-grid-cell" key={d.label}>
            <IosIcon
              label={d.label}
              icon={d.icon}
              tint={d.tint}
              glyph={IOS_GLYPHS[d.label]}
            />
          </div>
        ))}
      </div>

      <div className="ios-pagedots">
        <span className="ios-dot active" />
        <span className="ios-dot" />
      </div>

      <div className="ios-dock">
        {dockApps.map((a) => (
          <div className="ios-dock-cell" key={a.id}>
            <IosIcon
              label={a.label}
              icon={a.icon}
              tint={a.tint}
              hideLabel
              onClick={(rect) => onLaunch(a.id, rect)}
            />
            {a.id === "mail" && mailUnread > 0 && (
              <span className="ios-icon-badge ios-icon-badge-dock">
                {mailUnread}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
