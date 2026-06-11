enum Style {
    Reset = "\x1b[0m",
    Bright = "\x1b[1m",
    Dim = "\x1b[2m",
    Underscore = "\x1b[4m",
    Blink = "\x1b[5m",
    Reverse = "\x1b[7m",
    Hidden = "\x1b[8m",
}

enum Fg {
    Black = "\x1b[30m",
    Red = "\x1b[31m",
    Green = "\x1b[32m",
    Yellow = "\x1b[33m",
    Blue = "\x1b[34m",
    Magenta = "\x1b[35m",
    Cyan = "\x1b[36m",
    White = "\x1b[37m",
    Gray = "\x1b[90m",
}

enum Bg {
    Black = "\x1b[40m",
    Red = "\x1b[41m",
    Green = "\x1b[42m",
    Yellow = "\x1b[43m",
    Blue = "\x1b[44m",
    Magenta = "\x1b[45m",
    Cyan = "\x1b[46m",
    White = "\x1b[47m",
    Gray = "\x1b[100m",
}

type TextStyle = Fg | Bg | Style;

type WrapperFn = (s: any) => string;
type ColorWrapper = {
    style: Record<Lowercase<keyof typeof Style>, WrapperFn>,
    fg: Record<Lowercase<keyof typeof Fg>, WrapperFn>,
    bg: Record<Lowercase<keyof typeof Bg>, WrapperFn>,
    custom: (s: any, ...style: TextStyle[]) => string,
}

const color: ColorWrapper = {
    style: {
        reset: (s: any) => `${Style.Reset}${s}${Style.Reset}`,
        bright: (s: any) => `${Style.Bright}${s}${Style.Reset}`,
        dim: (s: any) => `${Style.Dim}${s}${Style.Reset}`,
        underscore: (s: any) => `${Style.Underscore}${s}${Style.Reset}`,
        blink: (s: any) => `${Style.Blink}${s}${Style.Reset}`,
        reverse: (s: any) => `${Style.Reverse}${s}${Style.Reset}`,
        hidden: (s: any) => `${Style.Hidden}${s}${Style.Reset}`,
    },
    fg: {
        black: (s: any) => `${Fg.Black}${s}${Style.Reset}`,
        red: (s: any) => `${Fg.Red}${s}${Style.Reset}`,
        green: (s: any) => `${Fg.Green}${s}${Style.Reset}`,
        yellow: (s: any) => `${Fg.Yellow}${s}${Style.Reset}`,
        blue: (s: any) => `${Fg.Blue}${s}${Style.Reset}`,
        magenta: (s: any) => `${Fg.Magenta}${s}${Style.Reset}`,
        cyan: (s: any) => `${Fg.Cyan}${s}${Style.Reset}`,
        white: (s: any) => `${Fg.White}${s}${Style.Reset}`,
        gray: (s: any) => `${Fg.Gray}${s}${Style.Reset}`,
    },
    bg: {
        black: (s: any) => `${Bg.Black}${s}${Style.Reset}`,
        red: (s: any) => `${Bg.Red}${s}${Style.Reset}`,
        green: (s: any) => `${Bg.Green}${s}${Style.Reset}`,
        yellow: (s: any) => `${Bg.Yellow}${s}${Style.Reset}`,
        blue: (s: any) => `${Bg.Blue}${s}${Style.Reset}`,
        magenta: (s: any) => `${Bg.Magenta}${s}${Style.Reset}`,
        cyan: (s: any) => `${Bg.Cyan}${s}${Style.Reset}`,
        white: (s: any) => `${Bg.White}${s}${Style.Reset}`,
        gray: (s: any) => `${Bg.Gray}${s}${Style.Reset}`,
    },
    custom: (s: any, ...style: (Fg | Bg | Style)[]) => `${style.join("")}${s}${Style.Reset}`,
}

export {
    Style, Fg, Bg, color
}