export interface CaptionWord {
    text: string;
    start_secs: number;
    end_secs: number;
    break_after?: 'none' | 'line' | 'cue';
    color?: string;
    font_size?: number;
    font_family?: string;
    pos_x_frac?: number;
    pos_y_frac?: number;
    motion?: string;
}

export interface CaptionStyle {
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: number;
    color?: string;
    background?: string;
    backgroundColor?: string;
    stroke?: string;
    strokeColor?: string;
    shadow?: boolean;
    posYFrac?: number;
    align?: 'left' | 'center' | 'right';
    animation?: 'none' | 'fade' | 'pop' | 'typewriter';
    wordHighlight?: boolean;
    highlightStyle?: string;
    wordsPerLine?: number;
    density?: 'sparse' | 'balanced' | 'dense';
}

export interface TimelineCaptionCue {
    id: string;
    startSecs: number;
    durationSecs: number;
    text: string;
    words: CaptionWord[];
    style?: Partial<CaptionStyle>;
}

export interface CaptionTemplate {
    id: string;
    name: string;
    description: string;
    category?: string;
    badge?: string;
    sampleText?: string;
    style: CaptionStyle;
}
