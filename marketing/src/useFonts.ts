import { useEffect, useState } from "react";
import { continueRender, delayRender } from "remotion";
import "./fonts/fonts.css";

/** Blocks rendering until the self-hosted IBM Plex Sans Thai faces (Thai + Latin) are loaded. */
export const useFonts = () => {
  const [handle] = useState(() => delayRender("fonts"));
  useEffect(() => {
    const sample = "กขคงจ ก็ ทดสอบ Aa";
    Promise.all(
      [400, 500, 600, 700].map((w) => document.fonts.load(`${w} 40px "IBM Plex Sans Thai"`, sample)),
    )
      .then(() => document.fonts.ready)
      .then(() => continueRender(handle))
      .catch(() => continueRender(handle));
  }, [handle]);
};
