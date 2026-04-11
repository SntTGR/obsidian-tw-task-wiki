export interface Annotation {
    date: string;
    content: string;
}

export type DescriptionFormat = 'desc' | 'oneline' | 'truncated' | 'count' | 'truncated_count' | 'combined';

export interface ParsedDescription {
    description: string;
    annotations: Annotation[];
    count: number | null;
    truncated: boolean;
}

export function getDescriptionFormat(columnType: string): DescriptionFormat {
    const dotIdx = columnType.indexOf('.');
    if (dotIdx === -1) return 'combined';
    const suffix = columnType.slice(dotIdx + 1);
    switch (suffix) {
        case 'desc':
        case 'oneline':
        case 'truncated':
        case 'count':
        case 'truncated_count':
        case 'combined':
            return suffix;
        default:
            return 'combined';
    }
}

const ANNOTATION_LINE_RE = /^(\d{4}-\d{2}-\d{2})\s+(.+)$/;
const COUNT_SUFFIX_RE = /\s\[(\d+)\]$/;
const ONELINE_DATE_RE = /(\d{4}-\d{2}-\d{2})\s+/g;

export function parseDescriptionData(data: string, format: DescriptionFormat): ParsedDescription {
    let remaining = data;
    let count: number | null = null;
    let truncated = false;

    if (format === 'count' || format === 'truncated_count') {
        const m = remaining.match(COUNT_SUFFIX_RE);
        if (m && m.index !== undefined) {
            count = parseInt(m[1], 10);
            remaining = remaining.slice(0, m.index);
        }
    }

    if (format === 'truncated' || format === 'truncated_count') {
        if (remaining.endsWith('...')) truncated = true;
    }

    const annotations: Annotation[] = [];

    if (format === 'combined') {
        const segments = remaining.split('\n\t');
        const description = segments[0];
        for (let i = 1; i < segments.length; i++) {
            const seg = segments[i];
            const m = seg.match(ANNOTATION_LINE_RE);
            if (m) {
                annotations.push({ date: m[1], content: m[2] });
            } else if (seg.length > 0) {
                annotations.push({ date: '', content: seg });
            }
        }
        return { description, annotations, count, truncated };
    }

    if (format === 'oneline') {
        ONELINE_DATE_RE.lastIndex = 0;
        const matches: Array<{ index: number; date: string; after: number }> = [];
        let m: RegExpExecArray | null;
        while ((m = ONELINE_DATE_RE.exec(remaining)) !== null) {
            matches.push({ index: m.index, date: m[1], after: ONELINE_DATE_RE.lastIndex });
        }
        if (matches.length === 0) {
            return { description: remaining, annotations, count, truncated };
        }
        const description = remaining.slice(0, matches[0].index).trimEnd();
        for (let i = 0; i < matches.length; i++) {
            const start = matches[i].after;
            const end = i + 1 < matches.length ? matches[i + 1].index : remaining.length;
            annotations.push({
                date: matches[i].date,
                content: remaining.slice(start, end).trim()
            });
        }
        return { description, annotations, count, truncated };
    }

    return { description: remaining, annotations, count, truncated };
}
