const fs = require('fs');
for(let i=1; i<=7; i++) {
  let f = 'Lab' + i + '.jsx';
  let c = fs.readFileSync(f, 'utf8');
  
  if (c.includes('<DashboardBuilder />')) continue;
  
  const regex = /const vizPanel = \([\s\S]+?\);\n/g;
  c = c.replace(regex, (match) => {
    let content = match.replace(/const vizPanel = \(\s*(<>)?/, '').replace(/(<\/>)?\s*\);\n$/, '');
    
    let otherComps = [];
    let serialMon = '';
    
    let lines = content.split('\n');
    for (let line of lines) {
      if (line.includes('SerialMonitor')) {
        if (lines.length <= 4) { // empty lines + SerialMonitor
           serialMon = line.replace(/height=\{.*?\}/, 'height="100%"');
        } else {
           serialMon = line.replace(/height=\{.*?\}/, 'height={350}');
        }
      } else if (line.trim().length > 0 && line.trim().startsWith('<')) {
        line = line.replace(/height=\{.*?\}/, 'height="100%"');
        otherComps.push(line);
      }
    }
    
    let newViz = `  const vizPanel = (\n    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', flex: 1, minHeight: 0 }}>\n`;
    if (otherComps.length > 0) {
      newViz += `      <div className="dashboard-grid">\n`;
      for (let comp of otherComps) {
        newViz += `      ${comp}\n`;
      }
      newViz += `      </div>\n`;
    }
    if (serialMon) {
      if (otherComps.length === 0) {
        newViz += `      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>\n  ${serialMon}\n      </div>\n`;
      } else {
        newViz += `      ${serialMon}\n`;
      }
    }
    newViz += `    </div>\n  );\n`;
    
    return newViz;
  });
  
  fs.writeFileSync(f, c);
}
console.log('Done');
