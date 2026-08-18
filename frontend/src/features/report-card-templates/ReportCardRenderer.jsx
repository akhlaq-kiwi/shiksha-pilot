import React from 'react';
import { compileReportCardData } from '../../common/services/reportCardEngine';
import ModernReportCardTemplate from './templates/ModernReportCardTemplate';
import ClassicCBSEReportCardTemplate from './templates/ClassicCBSEReportCardTemplate';
import TraditionalReportCardTemplate from './templates/TraditionalReportCardTemplate';
import CompactPrimaryReportCardTemplate from './templates/CompactPrimaryReportCardTemplate';
import SinglePageReportCardWrapper from './SinglePageReportCardWrapper';

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

  // Step 2: Determine active template code
  const activeTemplateCode = forcedTemplateCode || schoolProfile?.report_card_template?.code || card?.school?.report_card_template?.code || 'modern';
  const layoutConfig = customConfig || schoolProfile?.report_card_template?.layout_config || card?.school?.report_card_template?.layout_config || {};

  // Step 3: Dispatch to appropriate visual template
  const renderTemplate = () => {
    switch (activeTemplateCode) {
      case 'modern':
        return <ModernReportCardTemplate data={reportData} config={layoutConfig} />;

      case 'cbse_classic':
        return <ClassicCBSEReportCardTemplate data={reportData} config={layoutConfig} />;

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

