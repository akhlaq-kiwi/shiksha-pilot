import React from 'react';
import { compileReportCardData } from '../../common/services/reportCardEngine';
import ModernReportCardTemplate from './templates/ModernReportCardTemplate';
import ClassicCBSEReportCardTemplate from './templates/ClassicCBSEReportCardTemplate';
import TraditionalReportCardTemplate from './templates/TraditionalReportCardTemplate';
import CompactPrimaryReportCardTemplate from './templates/CompactPrimaryReportCardTemplate';
import SinglePageReportCardWrapper from './SinglePageReportCardWrapper';
import { resolveReportCardTheme } from './reportCardThemes';

/**
 * Report Card Renderer (Layer 2 Presentation Dispatcher)
 * Receives normalized card data & template selection, rendering the matching presentation component.
 */
export default function ReportCardRenderer({
  card = {},
  schoolProfile = {},
  currentYear = {},
  exam = {},
  forcedTemplateCode = null,
  customConfig = null,
  gradeScales = []
}) {
  const activeScales = Array.isArray(gradeScales) && gradeScales.length > 0
    ? gradeScales
    : (schoolProfile?.grade_scales || card?.grade_scales || []);

  // Step 1: Layer 1 calculation & data standardization
  const reportData = compileReportCardData(card, schoolProfile, currentYear, exam, activeScales);

  const activeTemplateCode = forcedTemplateCode || schoolProfile?.report_card_template?.code || card?.school?.report_card_template?.code || 'cbse_ocean_teal';
  
  // Resolve theme preference from customConfig, schoolProfile, layoutConfig or localStorage
  const schoolId = schoolProfile?.id || card?.school?.id || card?.school_id || '';
  const localTheme = typeof window !== 'undefined' && schoolId ? localStorage.getItem(`report_card_theme_${schoolId}`) : null;
  const activeColorTheme = customConfig?.color_theme 
    || schoolProfile?.report_card_color_theme 
    || schoolProfile?.report_card_template?.layout_config?.color_theme 
    || localTheme 
    || null;

  const baseConfig = customConfig || schoolProfile?.report_card_template?.layout_config || card?.school?.report_card_template?.layout_config || {};
  const layoutConfig = {
    ...baseConfig,
    ...(activeColorTheme ? { color_theme: activeColorTheme } : {})
  };

  // Step 3: Dispatch to appropriate visual template
  const renderTemplate = () => {
    switch (activeTemplateCode) {
      case 'modern':
        return <ModernReportCardTemplate data={reportData} config={layoutConfig} />;

      case 'cbse_classic':
      case 'cbse_royal_blue':
      case 'cbse_emerald_green':
      case 'cbse_warm_amber':
      case 'cbse_burgundy_plum':
      case 'cbse_ocean_teal':
        return (
          <ClassicCBSEReportCardTemplate
            data={reportData}
            config={layoutConfig}
            colorTheme={activeColorTheme}
            templateCode={activeTemplateCode}
          />
        );

      case 'primary_compact':
        return <CompactPrimaryReportCardTemplate data={reportData} config={layoutConfig} />;

      case 'traditional':
      default:
        return <TraditionalReportCardTemplate data={reportData} config={layoutConfig} />;
    }
  };

  return (
    <SinglePageReportCardWrapper subjectsCount={reportData.subjects?.length || 0}>
      {renderTemplate()}
    </SinglePageReportCardWrapper>
  );
}
