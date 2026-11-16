// ==UserScript==
// @name         YouTube Watched Marker
// @namespace    ex1lium.yt-watched-marker
// @version      1.0.0
// @updateURL    https://raw.githubusercontent.com/EX1lIUMRK/yt-watched-marker/main/yt-watched-marker.user.js
// @downloadURL  https://raw.githubusercontent.com/EX1lIUMRK/yt-watched-marker/main/yt-watched-marker.user.js
// @description  Marks watched YouTube videos: dims the thumbnail and overlays a one-line watched label once a video is watched 90% or more. The label is shown in the YouTube UI language — every language of the YouTube language menu is covered — and its size adapts to the thumbnail size. Works with both the classic and the new (lockup) YouTube markup. No settings, no external dependencies — works out of the box.
// @author       EX1lIUM
// @match        https://www.youtube.com/*
// @icon         https://www.youtube.com/favicon.ico
// @run-at       document-start
// @grant        GM_addStyle
// ==/UserScript==

/*
 * Fork of "YouTube Flag Watched" (yt/yt-watched.user.js) from the
 * mchangrh/uscripts repository: https://github.com/mchangrh/uscripts
 * Original author: michael (mchang.name). The upstream repository has no
 * license file, so the source link and original authorship are kept here.
 *
 * Fork author: EX1lIUM
 * Co-author: Muse — model Muse Spark 1.3 (Meta)
 *
 * Differences from the original:
 *  - the one-line label is shown in the YouTube UI language
 *    (see LABELS below) instead of a hard-coded "WATCHED";
 *  - adaptive label size: computed from the thumbnail width
 *    (container-type: inline-size + cqw units) instead of a fixed size,
 *    and shrunk for long labels so it always stays on one line;
 *  - a video counts as watched at 90% or more instead of exactly 100%;
 *  - both YouTube markups are covered: the classic ytd-thumbnail
 *    (legacy #progress and the current progress class) and the new
 *    lockup UI (yt-lockup-view-model with a "...BarSegment" bar).
 *
 * There are no settings and no external dependencies: install the script
 * and everything works automatically, out of the box.
 */

// A video counts as watched once this share of it (in percent) is watched.
const WATCHED_FROM_PERCENT = 90;

// "Watched" in every language offered by the YouTube language menu
// (83 menu entries; regional variants such as en-GB, es-419 or fr-CA
// share the translation of their base language). Keys are primary
// language subtags, with two script exceptions keyed by full code:
// Chinese ("zh-CN" Simplified, "zh-TW" Traditional) and Serbian
// ("sr" Cyrillic, "sr-Latn" Latin). Hebrew is keyed twice, because
// YouTube uses the legacy code "iw" where BCP 47 uses "he".
const LABELS = {
    af: "GEKYK",
    am: "ታይቷል",
    ar: "تمت المشاهدة",
    as: "চোৱা হৈছে",
    az: "BAXILIB",
    be: "ПРАГЛЕДЖАНА",
    bg: "ГЛЕДАНО",
    bn: "দেখা হয়েছে",
    bs: "GLEDANO",
    ca: "VIST",
    cs: "ZHLÉDNUTO",
    da: "SET",
    de: "GESEHEN",
    el: "ΠΑΡΑΚΟΛΟΥΘΗΘΗΚΕ",
    en: "WATCHED",
    es: "VISTO",
    et: "VAADATUD",
    eu: "IKUSITA",
    fa: "تماشا شده",
    fi: "KATSOTTU",
    fil: "NAPANOOD",
    fr: "VUE",
    gl: "VISTO",
    gu: "જોવાયું",
    he: "נצפה",
    hi: "देखा गया",
    hr: "GLEDANO",
    hu: "MEGNÉZVE",
    hy: "ԴԻՏՎԱԾ",
    id: "DITONTON",
    is: "HORFT Á",
    it: "VISTO",
    iw: "נצפה",
    ja: "視聴済み",
    ka: "ნანახია",
    kk: "КӨРІЛГЕН",
    km: "បានមើល",
    kn: "ವೀಕ್ಷಿಸಲಾಗಿದೆ",
    ko: "시청함",
    ky: "КӨРҮЛГӨН",
    lo: "ເບິ່ງແລ້ວ",
    lt: "ŽIŪRĖTA",
    lv: "SKATĪTS",
    mk: "ГЛЕДАНО",
    ml: "കണ്ടു",
    mn: "ҮЗЭСЭН",
    mr: "पाहिले",
    ms: "DITONTON",
    my: "ကြည့်ပြီး",
    nb: "SETT",
    ne: "हेरिएको",
    nl: "BEKEKEN",
    no: "SETT",
    or: "ଦେଖାଯାଇଛି",
    pa: "ਦੇਖਿਆ ਗਿਆ",
    pl: "OBEJRZANE",
    pt: "ASSISTIDO",
    ro: "VIZIONAT",
    ru: "ПРОСМОТРЕНО",
    si: "නරඹා ඇත",
    sk: "POZRETÉ",
    sl: "OGLEDANO",
    sq: "SHIKUAR",
    sr: "ГЛЕДАНО",
    "sr-Latn": "GLEDANO",
    sv: "SEDD",
    sw: "IMETAZAMWA",
    ta: "பார்க்கப்பட்டது",
    te: "చూడబడింది",
    th: "ดูแล้ว",
    tr: "İZLENDİ",
    uk: "ПЕРЕГЛЯНУТО",
    ur: "دیکھا گیا",
    uz: "KO‘RILGAN",
    vi: "ĐÃ XEM",
    "zh-CN": "已观看",
    "zh-TW": "已觀看",
    zu: "KUBUKIWE",
};

// Chinese region subtags that use Traditional characters
// (Taiwan, Hong Kong, Macau); all other Chinese is Simplified.
const TRADITIONAL_CHINESE = /-(tw|hk|mo)\b/;

// Serbian written in the Latin script ("sr-Latn" in the language menu,
// next to the Cyrillic "sr").
const LATIN_SERBIAN = /-latn\b/;

// The primary subtag of a language code: "pt-BR" -> "pt", "ru" -> "ru".
function primarySubtag(code) {
    return code.split("-")[0];
}

// Watched label in the language of the YouTube interface. The language
// is the value of the <html lang="..."> attribute that YouTube sets on
// every page (e.g. "ru", "en-US", "zh-TW", "sr-Latn"). Languages
// without a translation fall back to English.
function labelForLanguage(lang) {
    const code = (lang || "en").toLowerCase();
    const primary = primarySubtag(code);
    if (primary === "zh") {
        return TRADITIONAL_CHINESE.test(code) ? LABELS["zh-TW"] : LABELS["zh-CN"];
    }
    if (primary === "sr") {
        return LATIN_SERBIAN.test(code) ? LABELS["sr-Latn"] : LABELS.sr;
    }
    return LABELS[primary] || LABELS.en;
}

// Label font size in cqw (percent of the thumbnail width): 11 for labels
// up to 11 characters, proportionally smaller for longer ones, so any
// translation stays on a single line.
function labelSizeCqw(label) {
    const length = [...label].length;
    return parseFloat(Math.min(11, 121 / length).toFixed(1));
}

// Watched-thumbnail selectors for one percent, one per markup variant.
// Everywhere, YouTube stores the watch progress as an inline style like
// style="width: 93%;" on the progress element, so percents match exactly:
//  - classic, legacy: #progress inside ytd-thumbnail;
//  - classic, current: a div with the resume-playback progress class
//    inside ytd-thumbnail (the id was dropped, the class remains);
//  - lockup (new UI): a "...BarSegment" div inside yt-lockup-view-model.
function watchedSelectorsFor(percent) {
    const width = `[style="width: ${percent}%;"]`;
    return {
        classic: [
            `ytd-thumbnail:has(#progress${width})`,
            `ytd-thumbnail:has(.ytwThumbnailOverlayResumePlaybackRendererThumbnailOverlayResumePlaybackProgress${width})`,
        ],
        lockup: `yt-lockup-view-model:has(div[class*="BarSegment"]${width})`,
    };
}

// The selector groups for the whole stylesheet: for every watched
// percent, the thumbnails to dim and the thumbnails to label, across
// all markup variants.
function watchedSelectorGroups() {
    const dimSelectors = [];
    const labelSelectors = [];
    for (let percent = WATCHED_FROM_PERCENT; percent <= 100; percent++) {
        const { classic, lockup } = watchedSelectorsFor(percent);
        for (const thumbnail of classic) {
            dimSelectors.push(`${thumbnail}>#thumbnail`);
            labelSelectors.push(`${thumbnail}::after`);
        }
        dimSelectors.push(`${lockup} yt-thumbnail-view-model img`);
        labelSelectors.push(`${lockup} yt-thumbnail-view-model::after`);
    }
    return { dimSelectors, labelSelectors };
}

// The full stylesheet: dim watched thumbnails and overlay the label.
function buildCss(label) {
    const { dimSelectors, labelSelectors } = watchedSelectorGroups();

    return `
/* The thumbnails become containers: the label size derives from their width */
ytd-thumbnail, yt-thumbnail-view-model {
    container-type: inline-size;
}

/* Dim thumbnails watched 90% or more */
${dimSelectors.join(",\n")} {
    opacity: 0.35;
}

/* The watched label overlaid on the thumbnail */
${labelSelectors.join(",\n")} {
    content: "${label}";
    z-index: 2;
    color: white;
    top: 50%;
    transform: translateY(-50%);
    font-size: 1.4rem;  /* fallback size if container units are unsupported */
    font-size: ${labelSizeCqw(label)}cqw;   /* adaptive: percent of the thumbnail width */
    white-space: nowrap;
    text-align: center;
    text-transform: uppercase;
    position: absolute;
    width: 100%;
}
`;
}

GM_addStyle(buildCss(labelForLanguage(document.documentElement.lang)));
