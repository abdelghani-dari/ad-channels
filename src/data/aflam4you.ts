import { Channel } from "@/data/channels";

const THUMB = "https://channel.aflam4you.net/uploads/thumbs";

function aflamChannel(opts: {
  id: string;
  displayName: string;
  vid: number;
  streamUrl: string;
  category: Channel["category"];
  categoryKey: Channel["categoryKey"];
  themeColor: string;
  accentRgb: string;
  posterGradient: string;
}): Channel {
  return {
    id: opts.id,
    name: opts.displayName,
    displayName: opts.displayName,
    category: opts.category,
    categoryKey: opts.categoryKey,
    type: "Static",
    streamUrl: opts.streamUrl,
    description: "aflam4you live feed",
    currentShow: "Live",
    presenter: "aflam4you",
    viewers: "—",
    viewersNum: 0,
    avatar: `${THUMB}/${opts.vid}-1.jpg`,
    logoUrl: `${THUMB}/${opts.vid}-1.jpg`,
    posterGradient: opts.posterGradient,
    themeColor: opts.themeColor,
    accentRgb: opts.accentRgb,
    tags: ["aflam4you", "Live"],
    quality: "HD",
    source: "aflam4you",
    aflamVid: opts.vid,
  };
}

const BEIN_STYLE = {
  category: "Sports" as const,
  categoryKey: "sports" as const,
  themeColor: "#dc2626",
  accentRgb: "220, 38, 38",
  posterGradient: "from-zinc-800 to-zinc-950",
};

export const AFLAM_BEIN: Channel[] = [
  aflamChannel({ id: "aflam-bein-1", displayName: "beIN Sports 1", vid: 68, streamUrl: "https://pub-e3eb43d02df647099f49525f20574746.r2.dev/BMax1-4/index.m3u8", ...BEIN_STYLE }),
  aflamChannel({ id: "aflam-bein-2", displayName: "beIN Sports 2", vid: 2, streamUrl: "https://ksohls.ru/aflam.php?id=143", ...BEIN_STYLE }),
  aflamChannel({ id: "aflam-bein-3", displayName: "beIN Sports 3", vid: 1, streamUrl: "https://ksohls.ru/aflam.php?id=144", ...BEIN_STYLE }),
  aflamChannel({ id: "aflam-bein-4", displayName: "beIN Sports 4", vid: 3, streamUrl: "https://ksohls.ru/aflam.php?id=145", ...BEIN_STYLE }),
  aflamChannel({ id: "aflam-bein-5", displayName: "beIN Sports 5", vid: 73, streamUrl: "https://ksohls.ru/aflam.php?id=5", ...BEIN_STYLE }),
  aflamChannel({ id: "aflam-bein-6", displayName: "beIN Sports 6", vid: 74, streamUrl: "https://ksohls.ru/aflam.php?id=147", ...BEIN_STYLE }),
  aflamChannel({ id: "aflam-bein-7", displayName: "beIN Sports 7", vid: 75, streamUrl: "https://ksohls.ru/aflam.php?id=7", ...BEIN_STYLE }),
  aflamChannel({ id: "aflam-bein-8", displayName: "beIN Sports 8", vid: 76, streamUrl: "https://ksohls.ru/aflam.php?id=8", ...BEIN_STYLE }),
  aflamChannel({ id: "aflam-bein-9", displayName: "beIN Sports 9", vid: 69, streamUrl: "https://ava.karmakurama.com/?id=99", ...BEIN_STYLE }),
  aflamChannel({ id: "aflam-bein-10", displayName: "beIN Sports 10", vid: 30, streamUrl: "https://cb12.kooooora4you.live/p/3722/live/beinnnspor44444live.m3u8", ...BEIN_STYLE }),
  aflamChannel({ id: "aflam-bein-11", displayName: "beIN Sports 11", vid: 28, streamUrl: "https://ksohls.ru/aflam.php?id=141", ...BEIN_STYLE }),
  aflamChannel({ id: "aflam-bein-12", displayName: "beIN Sports 12", vid: 29, streamUrl: "https://ksohls.ru/aflam.php?id=141", ...BEIN_STYLE }),
  aflamChannel({ id: "aflam-bein-news", displayName: "beIN Sports News", vid: 31, streamUrl: "https://ksohls.ru/aflam.php?id=141", ...BEIN_STYLE }),
  aflamChannel({ id: "aflam-bein-max1", displayName: "beIN Sports Max 1", vid: 179, streamUrl: "https://lastvelvet.net/e/yxtmusy4xj8tj", ...BEIN_STYLE }),
  aflamChannel({ id: "aflam-bein-p1", displayName: "beIN Sports Premium 1", vid: 1010, streamUrl: "https://ksohls.ru/aflam.php?id=1", ...BEIN_STYLE }),
  aflamChannel({ id: "aflam-bein-p2", displayName: "beIN Sports Premium 2", vid: 2020, streamUrl: "https://ksohls.ru/aflam.php?id=2", ...BEIN_STYLE }),
  aflamChannel({ id: "aflam-bein-p3", displayName: "beIN Sports Premium 3", vid: 3030, streamUrl: "https://ksohls.ru/aflam.php?id=3", ...BEIN_STYLE }),
];

export const AFLAM_MAROC: Channel[] = [
  aflamChannel({
    id: "aflam-2m",
    displayName: "2M",
    vid: 8,
    streamUrl: "https://lastvelvet.net/e/fkknn6repsxl6",
    category: "News & General",
    categoryKey: "news",
    themeColor: "#3b82f6",
    accentRgb: "59, 130, 246",
    posterGradient: "from-blue-600 via-indigo-700 to-slate-900",
  }),
  aflamChannel({
    id: "aflam-arryadia",
    displayName: "Arryadia",
    vid: 4,
    streamUrl: "https://ksohls.ru/aflam.php?id=123",
    category: "Sports",
    categoryKey: "sports",
    themeColor: "#10b981",
    accentRgb: "16, 185, 129",
    posterGradient: "from-emerald-600 via-teal-800 to-slate-950",
  }),
  aflamChannel({
    id: "aflam-arryadia-tnt",
    displayName: "Arryadia TNT",
    vid: 2003,
    streamUrl: "https://ksohls.ru/aflam.php?id=123",
    category: "Sports",
    categoryKey: "sports",
    themeColor: "#8b5cf6",
    accentRgb: "139, 92, 246",
    posterGradient: "from-violet-600 via-purple-900 to-slate-950",
  }),
];
