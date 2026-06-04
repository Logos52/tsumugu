/**
 * Example Quartz v4 config for the Tsumugu wiki (Repo 2). Copy into your
 * extracted Quartz repo. Reuses the same toolchain as llm-knowledge-base.
 * Reference: https://quartz.jzhao.xyz/configuration
 */
import { QuartzConfig } from "./quartz/cfg";
import * as Plugin from "./quartz/plugins";

const config: QuartzConfig = {
  configuration: {
    pageTitle: "Tsumugu — LLM-wiki",
    enableSPA: true,
    enablePopovers: true,
    analytics: null, // privacy-first; no trackers
    baseUrl: "tsumugu-wiki.example.github.io",
    ignorePatterns: ["private", "templates", "Inbox", ".obsidian"],
    defaultDateType: "created",
    theme: {
      fontOrigin: "local", // offline-friendly: no remote font fetch
      cdnCaching: false,
      typography: { header: "Schibsted Grotesk", body: "Source Sans Pro", code: "IBM Plex Mono" },
      colors: {
        lightMode: {
          light: "#faf8f8", lightgray: "#e5e5e5", gray: "#b8b8b8",
          darkgray: "#4e4e4e", dark: "#2b2b2b", secondary: "#284b63",
          tertiary: "#84a59d", highlight: "rgba(143,159,169,0.15)", textHighlight: "#fff23688",
        },
        darkMode: {
          light: "#161618", lightgray: "#393639", gray: "#646464",
          darkgray: "#d4d4d4", dark: "#ebebec", secondary: "#7b97aa",
          tertiary: "#84a59d", highlight: "rgba(143,159,169,0.15)", textHighlight: "#b3aa0288",
        },
      },
    },
  },
  plugins: {
    transformers: [
      Plugin.FrontMatter(),
      Plugin.CreatedModifiedDate({ priority: ["frontmatter", "filesystem"] }),
      Plugin.SyntaxHighlighting(),
      Plugin.ObsidianFlavoredMarkdown({ enableInHtmlEmbed: false }),
      Plugin.GitHubFlavoredMarkdown(),
      Plugin.CrawlLinks({ markdownLinkResolution: "shortest" }),
      Plugin.Description(),
    ],
    filters: [Plugin.RemoveDrafts()],
    emitters: [
      Plugin.AliasRedirects(),
      Plugin.ComponentResources(),
      Plugin.ContentPage(),
      Plugin.FolderPage(),
      Plugin.TagPage(),
      Plugin.ContentIndex({ enableSiteMap: true, enableRSS: true }),
      Plugin.Assets(),
      Plugin.Static(),
      Plugin.NotFoundPage(),
    ],
  },
};

export default config;
