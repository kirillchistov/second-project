import { ProductAbout } from './ProductAbout';
import { ReactAbout } from './ReactAbout';

export const AboutPage = import.meta.env.MODE === 'product' ? ProductAbout : ReactAbout;
