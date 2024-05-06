export class TWPluginLogger {
    
    constructor(debugMode = false) {
        this.setDebugMode(debugMode);
    }

    setDebugMode(debugMode: boolean) {
        if (debugMode) { 
            this.debug_log = this._internalLog;
        } else {
            this.debug_log = () => {};
        }
    }

    private _internalLog(msg: unknown, ...optionalParams: unknown[]) {
        console.log(msg, ...optionalParams);
    }

    debug_log(msg: unknown, ...optionalParams: unknown[]) {}
    error_log(msg: unknown, ...optionalParams: unknown[]) {
        console.error(msg, ...optionalParams);
    }
    
}

export function sanitizeSingleArgument(input: string): string {
    return `"${input.replace(/"/g, '\\"')}"`;
}

export function sanitize(input: string): string {
    return sanitizeArguments(userArguments(input));
}

export function sanitizeArguments(userArguments: string[]): string {
    return userArguments.map((arg) => `"${arg.replace(/"/g, '\\"')}"`).join(' ');
}

export type ColorHSL = [number, number, number];

export function hexToHSL(Hex: string): ColorHSL {
        
    let r, g, b;

    if (Hex.length == 4) {
        r = "0x" + Hex[1] + Hex[1];
        g = "0x" + Hex[2] + Hex[2];
        b = "0x" + Hex[3] + Hex[3];
    } else if (Hex.length == 7) {
        r = "0x" + Hex[1] + Hex[2];
        g = "0x" + Hex[3] + Hex[4];
        b = "0x" + Hex[5] + Hex[6];
    }
    
    r = r as any / 255;
    g = g as any / 255;
    b = b as any / 255;

    let cmin = Math.min(r,g,b),
        cmax = Math.max(r,g,b),
        delta = cmax - cmin,
        h = 0,
        s = 0,
        l = 0;

    if (delta == 0)
        h = 0;
    else if (cmax == r)
        h = ((g - b) / delta) % 6;
    else if (cmax == g)
        h = (b - r) / delta + 2;
    else
        h = (r - g) / delta + 4;

    h = Math.round(h * 60);

    if (h < 0)
        h += 360;

    l = (cmax + cmin) / 2;
    s = delta == 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
    s = +(s * 100).toFixed(1);
    l = +(l * 100).toFixed(1);

    return [h, s, l];
}

const hexToHSLCache = new Map<string, ColorHSL>();
export function memoizedHexToHSL(hex: string): ColorHSL {
    const cachedResult = hexToHSLCache.get(hex);
    if (cachedResult !== undefined) return cachedResult;
    const hsl = hexToHSL(hex);
    hexToHSLCache.set(hex, hsl);
    return hsl;
}

export function hslLerp(a: ColorHSL, b: ColorHSL, t: number): ColorHSL {
    const h = a[0] + (b[0] - a[0]) * t;
    const s = a[1] + (b[1] - a[1]) * t;
    const l = a[2] + (b[2] - a[2]) * t;
    return [h, s, l];
}

export function threeColorHslLerp(a: ColorHSL, b: ColorHSL, c: ColorHSL, t: number): ColorHSL {
    const clampedT = Math.min(1, Math.max(0, t));
    
    if (clampedT < 0.5) {
        return hslLerp(a, b, clampedT * 2);
    } else {
        return hslLerp(b, c, (clampedT - 0.5) * 2);
    }
}

export function userArguments(input: string): string[] {
    // Split the input by spaces
    // respect quoted strings
    // respect escaped quotes

    const args: string[] = [];
    let current = '';
    let quoted = false;
    let escaped = false;

    for (let i = 0; i < input.length; i++) {
        const char = input[i];
        if (char === ' ' && !quoted && !escaped) {
            args.push(current);
            current = '';
        } else if (char === '"' && !escaped) {
            quoted = !quoted;
        } else if (char === '\\' && !escaped) {
            escaped = true;
        } else if (char !== '"' && escaped) {
            current += '\\' + char;
            escaped = false;
        } else {
            current += char;
            escaped = false;
        }
    }

    if (current !== '') {
        args.push(current);
    }

    console.log(args);

    return args;
}

