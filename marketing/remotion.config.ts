import { Config } from "@remotion/cli/config";
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setPixelFormat("yuv420p");
// Every picture comes from the real captures that live in the repo's docs/images (marketing/capture produces them).
Config.setPublicDir("../docs/images");
