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

  // Create hybrid format with HTML headers and plain text content
  let content = '';
  
  // Title
  content += '';

  const title = document.querySelector('#check-step-header-title').textContent.replace(/[\s]*/,'')
  content += `<h4><a href="${document.location.href}">${title} [${formatDuration(data.durationMs)}]</a></h4>`
 
  // Performance Metrics
  content += '<h5>⚡ METRICS</h5>';
  content += `<ul>`
  content += `<li>Total Duration: ${formatDuration(data.durationMs)}</li>`;
  content += `<li>Average Step Duration: ${formatDuration(avgStepDuration)}</li>`;
  content += `<li>Longest Step: ${longestStep.name} (${formatDuration(longestStep.durationMs)})</li>`;
  content += `<li>Shortest Step: ${shortestStep.name} (${formatDuration(shortestStep.durationMs)})</li>`;
  content += `<li>Total Steps: ${totalSteps}</li>`;
  content += `<li>✅ Successful: ${successfulSteps} (${Math.round(successfulSteps/totalSteps*100)}%)</li>`;
  content += `<li>❌ Failed: ${failedSteps} (${Math.round(failedSteps/totalSteps*100)}%)</li>`;
  content += `<li>⏹️ Cancelled: ${cancelledSteps} (${Math.round(cancelledSteps/totalSteps*100)}%)</li>`;
  content += `<li>⏭️ Skipped: ${skippedSteps} (${Math.round(skippedSteps/totalSteps*100)}%)</li>`;
  content += `</ul>`
  
  // Performance Insights
  content += '<h5>💡 INSIGHTS</h5>';
  content += "<ul>";
  
  if (longestStep.durationMs > avgStepDuration * 2) {
    content += `<li>⚠️ The step "${longestStep.name}" took significantly longer than the average in this run (${formatDuration(longestStep.durationMs)} vs ${formatDuration(avgStepDuration)})</li>`;
  }
  
  if (failedSteps > 0) {
    content += `<li>🔍 ${failedSteps} step(s) failed - review logs for potential issues</li>`;
  }
  
  if (skippedSteps > 0) {
    content += `<li>ℹ️ ${skippedSteps} step(s) were skipped - verify this is expected behavior</li>`;
  }
  
  content += "</ul>";
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
    content += '<h5>🎯 TOP TIME-CONSUMING TASKS (>5% of total time)</h5>';
    const totalTimeConsuming = timeConsumingSteps.reduce((sum, step) => sum + step.durationMs, 0);
    const totalPercentage = (totalTimeConsuming / data.durationMs * 100).toFixed(1);
    content += `📊 These ${timeConsumingSteps.length} steps consume ${totalPercentage}% of total workflow time`;
    content += "<ul>" 
    timeConsumingSteps.forEach((step, index) => {
      const statusEmoji = getStatusEmoji(step.conclusion);
      content += `<li> ${statusEmoji} <a href="${step.url}">${step.name}</a> (${step.percentage}% - ${formatDuration(step.durationMs)})</li>`;
    });
    content += "</ul>" 
    
  }
  
  // Other steps (papercuts)
  if (otherSteps.length > 0) {
    const totalOtherTime = otherSteps.reduce((sum, step) => sum + step.durationMs, 0);
    const otherPercentage = (totalOtherTime / data.durationMs * 100).toFixed(1);
    
    content += '<h5>📌 OTHER STEPS (papercuts - <5% each)</h5>';
    content += `${otherSteps.length} steps totaling ${formatDuration(totalOtherTime)} (${otherPercentage}% of total time)`;
    content += "<ul>"
    
    if (otherSteps.length <= 10) {
      // Show all other steps if there are 10 or fewer
      otherSteps.forEach((step, index) => {
        const statusEmoji = getStatusEmoji(step.conclusion);
        const percentage = (step.durationMs / data.durationMs * 100).toFixed(1);
        content += `<li> ${statusEmoji} <a href="${step.url}">${step.name}</a> (${percentage}% - ${formatDuration(step.durationMs)})</li>`;
      });
    } else {
      // Show top 5 other steps if there are more than 10
      content += '<li>Top 5 other steps:</li>';
      otherSteps.slice(0, 5).forEach((step, index) => {
        const statusEmoji = getStatusEmoji(step.conclusion);
        const percentage = (step.durationMs / data.durationMs * 100).toFixed(1);
        content += `<li> ${statusEmoji} <a href="${step.url}">${step.name}</a> (${percentage}% - ${formatDuration(step.durationMs)})</li>`;
      });
      content += `  <li>... and ${otherSteps.length - 5} more steps</li>`;
    }
    content += "</ul>"
  }

  // Notes
  content += '<h5>📝 NOTES</h5>';
  content += '<ul>'
  content += '<li>This report was generated automatically from GitHub Actions data</li>';
  content += '<li>Duration calculations are based on step start/end timestamps</li>';
  content += '<li>Status emojis: ✅ Success, ❌ Failure, ⏹️ Cancelled, ⏭️ Skipped, ❓ Unknown</li>';
  content += '</ul>'
  
  return content;
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

function copyToClipboard(text, isHtml = false, isRtf = false) {
  if (isRtf) {
    // For RTF content, create a rich text clipboard item
    const rtfBlob = new Blob([text], { type: 'application/rtf' });
    const textBlob = new Blob([text.replace(/\\[^\\]*\\/g, '')], { type: 'text/plain' });
    
    const clipboardItem = new ClipboardItem({
      'application/rtf': rtfBlob,
      'text/plain': textBlob
    });
    
    navigator.clipboard.write([clipboardItem]).then(() => {
      console.log('RTF data copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy RTF to clipboard:', err);
      // Fallback to plain text
      copyToClipboard(text.replace(/\\[^\\]*\\/g, ''), false, false);
    });
  } else if (isHtml) {
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
      copyToClipboard(text.replace(/<[^>]*>/g, ''), false, false);
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
  copyToClipboard(formatted, true, false);
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
