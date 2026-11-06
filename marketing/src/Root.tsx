import React from "react";
import { Composition, Still } from "remotion";
import { useFonts } from "./useFonts";
import { PosterA3, A3_W, A3_H, PosterSquare, SQ, PosterWide, WIDE_W, WIDE_H, ToolCard, InstallCard, DownloadCard, CARD_W, CARD_H } from "./posters";
import { Tutorial, TUTORIAL_FRAMES } from "./video/Tutorial";
import { Short, SHORT_FRAMES } from "./video/Short";
import { TOOLS } from "./content";

const withFonts = <P extends object>(C: React.FC<P>): React.FC<P> => (p) => { useFonts(); return <C {...p} />; };
const Card = withFonts(ToolCard);

export const Root: React.FC = () => (
  <>
    <Still id="PosterA3" component={withFonts(PosterA3)} width={A3_W} height={A3_H} />
    <Still id="PosterSquare" component={withFonts(PosterSquare)} width={SQ} height={SQ} />
    <Still id="PosterWide" component={withFonts(PosterWide)} width={WIDE_W} height={WIDE_H} />
    <Still id="Card" component={Card as React.FC<Record<string, unknown>>} width={CARD_W} height={CARD_H} defaultProps={{ i: 0 }} />
    <Still id="InstallCard" component={withFonts(InstallCard)} width={CARD_W} height={CARD_H} />
    <Still id="DownloadCard" component={withFonts(DownloadCard)} width={CARD_W} height={CARD_H} />
    <Composition id="Tutorial" component={withFonts(Tutorial)} width={1920} height={1080} fps={30} durationInFrames={TUTORIAL_FRAMES} />
    <Composition id="Short" component={withFonts(Short)} width={1080} height={1920} fps={30} durationInFrames={SHORT_FRAMES} />
  </>
);
export const TOOL_COUNT = TOOLS.length;
