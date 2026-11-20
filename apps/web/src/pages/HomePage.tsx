import { ProductHome } from './ProductHome';
import { ReactHome } from './ReactHome';

export const HomePage = import.meta.env.MODE === 'product' ? ProductHome : ReactHome;
