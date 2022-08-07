/*
 * @author: tisfeng
 * @createTime: 2022-08-03 00:02
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-08-06 21:21
 * @fileName: formatData.ts
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import { DicionaryType, SectionDisplayItem } from "../../types";
import {
  QueryWordInfo,
  YoudaoDictionaryFormatResult,
  YoudaoDictionaryListItemType,
  YoudaoDictionaryResult,
} from "./types";

/**
 * Format the Youdao original data for later use.
 */
export function formatYoudaoDictionaryResult(youdaoResult: YoudaoDictionaryResult): YoudaoDictionaryFormatResult {
  const [from, to] = youdaoResult.l.split("2"); // from2to
  let usPhonetic = youdaoResult.basic?.["us-phonetic"]; // may be two phonetic "trænzˈleɪʃn; trænsˈleɪʃn"
  usPhonetic = usPhonetic?.split("; ")[1] || usPhonetic;
  const queryWordInfo: QueryWordInfo = {
    word: youdaoResult.query,
    phonetic: usPhonetic || youdaoResult.basic?.phonetic,
    fromLanguage: from,
    toLanguage: to,
    isWord: youdaoResult.isWord,
    examTypes: youdaoResult.basic?.exam_type,
    speechUrl: youdaoResult.speakUrl,
  };

  let webTranslation;
  if (youdaoResult.web) {
    webTranslation = youdaoResult.web[0];
  }
  const webPhrases = youdaoResult.web?.slice(1);
  return {
    queryWordInfo: queryWordInfo,
    translations: youdaoResult.translation,
    explanations: youdaoResult.basic?.explains,
    forms: youdaoResult.basic?.wfs,
    webTranslation: webTranslation,
    webPhrases: webPhrases,
  };
}

/**
 * Update Youdao dictionary display result.
 */
export function updateYoudaoDictionaryDisplay(formatResult: YoudaoDictionaryFormatResult | null): SectionDisplayItem[] {
  const sectionResult: Array<SectionDisplayItem> = [];
  if (!formatResult) {
    return sectionResult;
  }

  const youdaoType = DicionaryType.Youdao;
  const oneLineTranslation = formatResult.translations.join(" ");
  const phoneticText = formatResult.queryWordInfo.phonetic ? `[${formatResult.queryWordInfo.phonetic}]` : undefined;
  const isShowWordSubtitle = phoneticText || formatResult.queryWordInfo.examTypes;
  const wordSubtitle = isShowWordSubtitle ? formatResult.queryWordInfo.word : undefined;

  sectionResult.push({
    type: youdaoType,
    sectionTitle: `${youdaoType}`,
    items: [
      {
        displayType: YoudaoDictionaryListItemType.Translation,
        key: oneLineTranslation + youdaoType,
        title: ` ${oneLineTranslation}`,
        subtitle: wordSubtitle,
        tooltip: `Translate`,
        copyText: oneLineTranslation,
        queryWordInfo: formatResult.queryWordInfo,
        // translationMarkdown: this.formatAllTypeTranslationToMarkdown(type, formatResult),
        accessoryItem: {
          phonetic: phoneticText,
          examTypes: formatResult.queryWordInfo.examTypes,
        },
      },
    ],
  });

  let hasShowDetailsSectionTitle = false;
  const detailsSectionTitle = "Details";

  formatResult.explanations?.forEach((explanation, i) => {
    sectionResult.push({
      type: YoudaoDictionaryListItemType.Explanations,
      sectionTitle: !hasShowDetailsSectionTitle ? detailsSectionTitle : undefined,
      items: [
        {
          displayType: YoudaoDictionaryListItemType.Explanations,
          key: explanation + i,
          title: explanation,
          queryWordInfo: formatResult.queryWordInfo,
          tooltip: YoudaoDictionaryListItemType.Explanations,
          copyText: explanation,
        },
      ],
    });

    hasShowDetailsSectionTitle = true;
  });

  const wfs = formatResult.forms?.map((wfItem) => {
    return wfItem.wf?.name + " " + wfItem.wf?.value;
  });

  // [ 复数 goods   比较级 better   最高级 best ]
  const wfsText = wfs?.join("   ") || "";
  if (wfsText.length) {
    sectionResult.push({
      type: YoudaoDictionaryListItemType.Forms,
      sectionTitle: !hasShowDetailsSectionTitle ? detailsSectionTitle : undefined,
      items: [
        {
          displayType: YoudaoDictionaryListItemType.Forms,
          key: wfsText,
          title: "",
          queryWordInfo: formatResult.queryWordInfo,
          tooltip: YoudaoDictionaryListItemType.Forms,
          subtitle: `[ ${wfsText} ]`,
          copyText: wfsText,
        },
      ],
    });

    hasShowDetailsSectionTitle = true;
  }

  if (formatResult.webTranslation) {
    const webResultKey = formatResult.webTranslation?.key;
    const webResultValue = formatResult.webTranslation.value.join("；");
    const copyText = `${webResultKey} ${webResultValue}`;
    sectionResult.push({
      type: YoudaoDictionaryListItemType.WebTranslation,
      sectionTitle: !hasShowDetailsSectionTitle ? detailsSectionTitle : undefined,
      items: [
        {
          displayType: YoudaoDictionaryListItemType.WebTranslation,
          key: copyText,
          title: webResultKey,
          queryWordInfo: formatResult.queryWordInfo,
          tooltip: YoudaoDictionaryListItemType.WebTranslation,
          subtitle: webResultValue,
          copyText: copyText,
        },
      ],
    });

    hasShowDetailsSectionTitle = true;
  }

  formatResult.webPhrases?.forEach((phrase, i) => {
    const phraseKey = phrase.key;
    const phraseValue = phrase.value.join("；");
    const copyText = `${phraseKey} ${phraseValue}`;
    sectionResult.push({
      type: YoudaoDictionaryListItemType.WebPhrase,
      sectionTitle: !hasShowDetailsSectionTitle ? detailsSectionTitle : undefined,
      items: [
        {
          displayType: YoudaoDictionaryListItemType.WebPhrase,
          key: copyText + i,
          title: phraseKey,
          queryWordInfo: formatResult.queryWordInfo,
          tooltip: YoudaoDictionaryListItemType.WebPhrase,
          subtitle: phraseValue,
          copyText: copyText,
        },
      ],
    });

    hasShowDetailsSectionTitle = true;
  });

  return sectionResult;
}

/**
 * Check if Youdao dictionary empty.
 */
export function isYoudaoDictionaryEmpty(formatResult: YoudaoDictionaryFormatResult) {
  return !(formatResult.explanations || formatResult.forms || formatResult.webPhrases || formatResult.webTranslation);
}