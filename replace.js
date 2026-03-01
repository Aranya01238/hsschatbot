const fs = require('fs');
let content = fs.readFileSync('nurse-maya.tsx', 'utf8');

const replacement = `            <video
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover"
              src={\`/animations/female/\${avatarState === 'idle' ? 'Idle' : avatarState}_female.mp4\`}
            />`;

content = content.replace(/\{\/\*\s*Integrated Female SVG Avatar\s*\*\/\}\s*<svg.*?<\/svg>/s, replacement);
fs.writeFileSync('nurse-maya.tsx', content);
