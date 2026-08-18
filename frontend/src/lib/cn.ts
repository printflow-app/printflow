import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Klass birlashtirish: shartli klasslar (clsx) + Tailwind to'qnashuvlarini
// oxirgisi yutadigan qilib eritish (twMerge). Prop orqali kelgan className
// komponent ichidagi standart klassni bosib o'ta olsin.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default cn;
