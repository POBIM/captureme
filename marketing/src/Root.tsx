import React from "react";
import { Composition, Still } from "remotion";
import { useFonts } from "./useFonts";
import { PosterA3, A3_W, A3_H } from "./poster/PosterA3";
import { PosterSquare, SQ } from "./poster/PosterSquare";
import { PosterWide, WIDE_W, WIDE_H } from "./poster/PosterWide";
import { Lab } from "./video/Lab";
import { Tutorial, TUTORIAL_FRAMES } from "./video/Tutorial";
import { Short, SHORT_FRAMES } from "./video/Short";

const withFonts = (C: React.FC): React.FC => () => { useFonts(); return <C />; };

export const Root: React.FC = () => (
  <>
    <Still id="Poster" component={withFonts(PosterA3)} width={A3_W} height={A3_H} />
    <Still id="PosterSquare" component={withFonts(PosterSquare)} width={SQ} height={SQ} />
    <Still id="PosterWide" component={withFonts(PosterWide)} width={WIDE_W} height={WIDE_H} />
    <Composition id="Tutorial" component={withFonts(Tutorial)} width={1920} height={1080} fps={30} durationInFrames={TUTORIAL_FRAMES} />
    <Composition id="Short" component={withFonts(Short)} width={1080} height={1920} fps={30} durationInFrames={SHORT_FRAMES} />
    <Composition id="Lab" component={withFonts(Lab)} width={1920} height={1080} fps={30} durationInFrames={30 * 60} />
  </>
);
