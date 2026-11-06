import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Backdrop, DemoSlot } from "./common";
import { InstallDemo } from "./demos-install";
import { CaptureDemo } from "./demos-capture";
import { EditorDemo } from "./demos-editor";
import { ToolsDemo } from "./demos-tools";
import { AdvDemo } from "./demos-adv";
import { SettingsDemo } from "./demos-settings";
const Demo: any = ToolsDemo; void AdvDemo; void SettingsDemo; void EditorDemo; void ToolsDemo; void InstallDemo; void CaptureDemo;

/** Dev-only: shows a single demo at t = frame/30 s. Edit freely. */
export const Lab: React.FC = () => {
  const t = useCurrentFrame() / 30;
  return (
    <AbsoluteFill>
      <Backdrop />
      <DemoSlot t={5}><Demo t={t} /></DemoSlot>
    </AbsoluteFill>
  );
};
