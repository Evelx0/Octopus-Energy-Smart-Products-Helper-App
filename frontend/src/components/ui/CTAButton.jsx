import { Link } from 'react-router-dom';

// Generic styled button for internal navigation. No referral URLs.
export default function CTAButton({ label, to, href, onClick, className = '', variant = 'pink' }) {
  const base = 'cta-button inline-block font-bold py-2 px-6 rounded-full shadow-lg text-white';
  const variants = {
    pink: 'bg-pink-500 hover:bg-pink-400',
    teal: 'bg-octopus-teal hover:bg-teal-400',
    dark: 'bg-gray-700 hover:bg-gray-600',
  };
  const cls = `${base} ${variants[variant] ?? variants.pink} ${className}`;

  if (href) {
    return <a href={href} className={cls}>{label}</a>;
  }
  if (to) {
    return <Link to={to} className={cls}>{label}</Link>;
  }
  return <button onClick={onClick} className={cls}>{label}</button>;
}
