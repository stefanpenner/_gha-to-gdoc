function extractStep(step, index) {
  return {
    name: step.name,
    url:  document.URL.replace(/#.*$/,"")+ `#step:${index+1}:1`,
    externalId: step.externalId,
    conclusion: step.conclusion,
    duration: step.preciseDuration(),
    durationMs: new Date(step.completedAt) - new Date(step.startedAt),
    completedAt: step.completedAt,
    startedAt: step.startedAt
  };
}

function extractData() {
  const steps = [...document.querySelectorAll('check-step')].map(extractStep)
  let durationMs = 0

  for (let step of steps) {
    durationMs += step.durationMs
  }

  return {
    uri: document.documentURI,
    title: document.title,
    durationMs,
    steps: steps
  }
}

function formatForGoogleDocs(data) {
  const formatDuration = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const getStatusEmoji = (status) => {
    switch(status?.toLowerCase()) {
      case 'success': return '✅';
      case 'failure': return '❌';
      case 'cancelled': return '⏹️';
      case 'skipped': return '⏭️';
      default: return '❓';
    }
  };

  // Calculate summary statistics
  const totalSteps = data.steps.length;
  const successfulSteps = data.steps.filter(s => s.conclusion?.toLowerCase() === 'success').length;
  const failedSteps = data.steps.filter(s => s.conclusion?.toLowerCase() === 'failure').length;
  const skippedSteps = data.steps.filter(s => s.conclusion?.toLowerCase() === 'skipped').length;
  const cancelledSteps = data.steps.filter(s => s.conclusion?.toLowerCase() === 'cancelled').length;
  
  const avgStepDuration = data.durationMs / totalSteps;
  const longestStep = data.steps.reduce((max, step) => step.durationMs > max.durationMs ? step : max, data.steps[0]);
  const shortestStep = data.steps.reduce((min, step) => step.durationMs < min.durationMs ? step : min, data.steps[0]);

  // Create formatted text with clear section breaks
  let doc = `📊 GitHub Actions Workflow Analysis Report\n\n`;
  
  // Executive Summary
  doc += `Workflow Name: ${data.title}\n`;
  doc += `Workflow URL: ${data.uri}\n`;
  doc += `Analysis Date: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}\n\n`;
  
  // Performance Metrics
  doc += `⚡ METRICS\n\n`;
  doc += `Total Duration: ${formatDuration(data.durationMs)}\n`;
  doc += `Average Step Duration: ${formatDuration(avgStepDuration)}\n`;
  doc += `Longest Step: ${longestStep.name} (${formatDuration(longestStep.durationMs)})\n`;
  doc += `Shortest Step: ${shortestStep.name} (${formatDuration(shortestStep.durationMs)})\n`;
  doc += `Total Steps: ${totalSteps}\n`;
  doc += `✅ Successful: ${successfulSteps} (${Math.round(successfulSteps/totalSteps*100)}%)\n`;
  doc += `❌ Failed: ${failedSteps} (${Math.round(failedSteps/totalSteps*100)}%)\n`;
  doc += `⏹️ Cancelled: ${cancelledSteps} (${Math.round(cancelledSteps/totalSteps*100)}%)\n`;
  doc += `⏭️ Skipped: ${skippedSteps} (${Math.round(skippedSteps/totalSteps*100)}%)\n\n`;
  
  // Performance Insights
  doc += `💡 INSIGHTS\n\n`;
  
  if (longestStep.durationMs > avgStepDuration * 2) {
    doc += `• ⚠️ The step "${longestStep.name}" took significantly longer than average (${formatDuration(longestStep.durationMs)} vs ${formatDuration(avgStepDuration)})\n`;
  }
  
  if (failedSteps > 0) {
    doc += `• 🔍 ${failedSteps} step(s) failed - review logs for potential issues\n`;
  }
  
  if (skippedSteps > 0) {
    doc += `• ℹ️ ${skippedSteps} step(s) were skipped - verify this is expected behavior\n`;
  }
  
  // Top Time-Consuming Tasks Analysis
  const fivePercentThreshold = data.durationMs * 0.05;
  const timeConsumingSteps = data.steps
    .filter(step => step.durationMs >= fivePercentThreshold)
    .sort((a, b) => b.durationMs - a.durationMs)
    .map(step => ({
      ...step,
      percentage: (step.durationMs / data.durationMs * 100).toFixed(1)
    }));
  
  const otherSteps = data.steps
    .filter(step => step.durationMs < fivePercentThreshold)
    .sort((a, b) => b.durationMs - a.durationMs);
  
  if (timeConsumingSteps.length > 0) {
    doc += `\n🎯 TOP TIME-CONSUMING TASKS (>5% of total time)\n\n`;
    
    timeConsumingSteps.forEach((step, index) => {
      const statusEmoji = getStatusEmoji(step.conclusion);
      doc += `${index + 1}. ${statusEmoji} ${step.name} (${step.percentage}% - ${formatDuration(step.durationMs)})\n`;
    });
    
    const totalTimeConsuming = timeConsumingSteps.reduce((sum, step) => sum + step.durationMs, 0);
    const totalPercentage = (totalTimeConsuming / data.durationMs * 100).toFixed(1);
    doc += `\n📊 These ${timeConsumingSteps.length} steps consume ${totalPercentage}% of total workflow time\n`;
  }
  
  // Other steps (papercuts)
  if (otherSteps.length > 0) {
    const totalOtherTime = otherSteps.reduce((sum, step) => sum + step.durationMs, 0);
    const otherPercentage = (totalOtherTime / data.durationMs * 100).toFixed(1);
    
    doc += `\n📌 OTHER STEPS (papercuts - <5% each)\n\n`;
    doc += `• ${otherSteps.length} steps totaling ${formatDuration(totalOtherTime)} (${otherPercentage}% of total time)\n`;
    
    if (otherSteps.length <= 10) {
      // Show all other steps if there are 10 or fewer
      otherSteps.forEach((step, index) => {
        const statusEmoji = getStatusEmoji(step.conclusion);
        const percentage = (step.durationMs / data.durationMs * 100).toFixed(1);
        doc += `  ${index + 1}. ${statusEmoji} ${step.name} (${percentage}% - ${formatDuration(step.durationMs)})\n`;
      });
    } else {
      // Show top 5 other steps if there are more than 10
      doc += `• Top 5 other steps:\n`;
      otherSteps.slice(0, 5).forEach((step, index) => {
        const statusEmoji = getStatusEmoji(step.conclusion);
        const percentage = (step.durationMs / data.durationMs * 100).toFixed(1);
        doc += `  ${index + 1}. ${statusEmoji} ${step.name} (${percentage}% - ${formatDuration(step.durationMs)})\n`;
      });
      doc += `  ... and ${otherSteps.length - 5} more steps\n`;
    }
  }

   // Detailed Step Analysis
   // doc += `🔍 DETAILED STEP ANALYSIS\n\n`;
   //
   // data.steps.forEach((step, index) => {
   //   const statusEmoji = getStatusEmoji(step.conclusion);
   //   const stepNumber = String(index + 1).padStart(2, '0');
   //   const startedTime = new Date(step.startedAt).toLocaleTimeString();
   //   const completedTime = new Date(step.completedAt).toLocaleTimeString();
   //
   //   doc += `${stepNumber}. ${statusEmoji} ${step.name} | ${step.conclusion || 'Unknown'} | ${formatDuration(step.durationMs)} | ${startedTime} → ${completedTime}\n`;
   // });
   
   doc += `\n`;

  doc += `\n📝 NOTES\n\n`;
  doc += `• This report was generated automatically from GitHub Actions data\n`;
  doc += `• Duration calculations are based on step start/end timestamps\n`;
  doc += `• Status emojis: ✅ Success, ❌ Failure, ⏹️ Cancelled, ⏭️ Skipped, ❓ Unknown\n`;
  
  return doc;
}

function formatForGoogleSheets(data) {
  const formatDuration = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}:${String(minutes % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    } else {
      return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
    }
  };

  // Create tab-separated format for easy paste into Google Sheets
  let tsv = `Step Name\tStatus\tDuration\tStarted At\tCompleted At\tExternal ID\n`;
  
  data.steps.forEach(step => {
    const startedAt = new Date(step.startedAt).toLocaleString();
    const completedAt = new Date(step.completedAt).toLocaleString();
    const duration = formatDuration(step.durationMs);
    
    tsv += `${step.name}\t${step.conclusion || 'Unknown'}\t${duration}\t${startedAt}\t${completedAt}\t${step.externalId || ''}\n`;
  });
  
  return tsv;
}

function formatForGoogleSheetsCSV(data) {
  const formatDuration = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}:${String(minutes % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    } else {
      return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
    }
  };

  // Create CSV format for file download
  let csv = `Step Name,Status,Duration,Started At,Completed At,External ID\n`;
  
  data.steps.forEach(step => {
    const startedAt = new Date(step.startedAt).toLocaleString();
    const completedAt = new Date(step.completedAt).toLocaleString();
    const duration = formatDuration(step.durationMs);
    
    csv += `"${step.name}","${step.conclusion || 'Unknown'}","${duration}","${startedAt}","${completedAt}","${step.externalId || ''}"\n`;
  });
  
  return csv;
}

function copyToClipboard(text, isHtml = false) {
  if (isHtml) {
    // For HTML content, create a rich text clipboard item
    const htmlBlob = new Blob([text], { type: 'text/html' });
    const textBlob = new Blob([text.replace(/<[^>]*>/g, '')], { type: 'text/plain' });
    
    const clipboardItem = new ClipboardItem({
      'text/html': htmlBlob,
      'text/plain': textBlob
    });
    
    navigator.clipboard.write([clipboardItem]).then(() => {
      console.log('Rich text data copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy rich text to clipboard:', err);
      // Fallback to plain text
      copyToClipboard(text.replace(/<[^>]*>/g, ''), false);
    });
  } else {
    navigator.clipboard.writeText(text).then(() => {
      console.log('Data copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy to clipboard:', err);
      // Fallback method that works even when document is not focused
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (successful) {
          console.log('Data copied to clipboard (fallback method)!');
        } else {
          console.log('Fallback copy failed, showing data in console instead');
          console.log('Copy this data manually:');
          console.log(text);
        }
      } catch (fallbackErr) {
        console.error('All copy methods failed:', fallbackErr);
        console.log('Copy this data manually:');
        console.log(text);
      }
    });
  }
}

// Helper functions to easily get formatted data
function getDataForGoogleDocs() {
  const data = extractData();
  return formatForGoogleDocs(data);
}

function getDataForGoogleSheets() {
  const data = extractData();
  return formatForGoogleSheets(data);
}

function getDataForGoogleSheetsCSV() {
  const data = extractData();
  return formatForGoogleSheetsCSV(data);
}

// Copy functions for easy use
function copyForGoogleDocs() {
  const formatted = getDataForGoogleDocs();
  copyToClipboard(formatted);
}

function copyForGoogleSheets() {
  const formatted = getDataForGoogleSheets();
  copyToClipboard(formatted);
}

function copyForGoogleSheetsCSV() {
  const formatted = getDataForGoogleSheetsCSV();
  copyToClipboard(formatted);
}

// Download CSV file function
function downloadCSV() {
  const data = extractData();
  const csv = formatForGoogleSheetsCSV(data);
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'github-actions-data.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

copyForGoogleDocs()
