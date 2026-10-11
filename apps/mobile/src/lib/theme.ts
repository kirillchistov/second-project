import { useColorScheme } from 'react-native';

const light = {
  bg: '#F6F8FA',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF1F4',
  border: '#D0D7DE',
  text: '#1F2328',
  textMuted: '#59636E',
  accent: '#0A84C2',
  accentSoft: '#DDF1FB',
  success: '#1A7F37',
  successSoft: '#DAFBE1',
  danger: '#CF222E',
  dangerSoft: '#FFEBE9',
  warning: '#9A6700',
  // Цвета «зелёных клеточек» активности, от пустой до яркой
  heat: ['#EBEDF0', '#9BE9A8', '#40C463', '#30A14E', '#216E39'],
  codeBg: '#F6F8FA',
};

const dark: typeof light = {
  bg: '#0D1117',
  surface: '#161B22',
  surfaceAlt: '#21262D',
  border: '#30363D',
  text: '#E6EDF3',
  textMuted: '#9198A1',
  accent: '#58C4F0',
  accentSoft: '#0B2D3D',
  success: '#3FB950',
  successSoft: '#12261E',
  danger: '#F85149',
  dangerSoft: '#2D1517',
  warning: '#D29922',
  heat: ['#161B22', '#0E4429', '#006D32', '#26A641', '#39D353'],
  codeBg: '#0D1117',
};

export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}

export const MONO = 'Menlo';
