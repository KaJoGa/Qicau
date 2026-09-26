import * as fs from 'fs';
import * as path from 'path';

function processFile(filepath: string) {
    let content = fs.readFileSync(filepath, 'utf8');

    // Regex to match className attribute string
    content = content.replace(/className=(?:\{`([^`]+)`\}|"([^"]+)")/g, (match, p1, p2) => {
        let classesStr = p1 || p2;
        if (!classesStr) return match;
        
        const classes = classesStr.split(/\s+/);
        const newClasses = classes.map(c => {
            if (c === 'text-neutral-500' && !classes.includes('dark:text-neutral-400')) {
                return 'text-neutral-600 dark:text-neutral-400';
            } else if (c === 'text-neutral-400' && !classes.includes('dark:text-neutral-400') && !classes.includes('dark:text-neutral-500')) {
                return 'text-neutral-500 dark:text-neutral-400';
            }
            return c;
        });

        // Join uniquely so we don't duplicate classes if any
        let finalClasses = Array.from(new Set(newClasses.join(' ').split(/\s+/))).join(' ');
        
        if (p1) {
            return `className={\`${finalClasses}\`}`;
        } else {
            return `className="${finalClasses}"`;
        }
    });

    fs.writeFileSync(filepath, content);
}

function walk(dir: string) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filepath = path.join(dir, file);
        if (fs.statSync(filepath).isDirectory()) {
            walk(filepath);
        } else if (filepath.endsWith('.tsx') || filepath.endsWith('.ts')) {
            processFile(filepath);
        }
    }
}

walk('./src');
console.log('done');
