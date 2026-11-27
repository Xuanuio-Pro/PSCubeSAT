import { LABS } from '../../data/lab-metadata';

// Accent-insensitive: "nang luong" finds "Năng lượng".
const fold = text => String(text || '').normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/gi, 'd').toLowerCase();
const LAB_INDEX = LABS.map(lab => ({ lab, haystack: fold(`lab ${lab.id} ${lab.title} ${lab.subtitle}`) }));

export function searchLabs(query) {
  const terms = fold(query).trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return LAB_INDEX.filter(item => terms.every(term => item.haystack.includes(term))).map(item => item.lab);
}
