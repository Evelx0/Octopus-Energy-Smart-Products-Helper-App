import { useState, useRef, useEffect } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import logo from '../../assets/logo.svg';

// ─── Static nav — no CMS API call ────────────────────────────────────────────
const NAV_ITEMS = [
  { id: 'home', href: '/', label: 'Home', type: 'navlink', end: true },
  {
    id: 'price-trackers',
    label: 'Price Trackers',
    type: 'dropdown',
    children: [
      { id: 'agile-t',          href: '/agile-tracker',    label: 'Agile Price Tracker' },
      { id: 'tracker-t',        href: '/tracker-prices',   label: 'Tracker Price Tracker' },
      { id: 'region-lookup',    href: '/region-lookup',    label: 'Postcode → Region Lookup' },
      { id: 'bill-calc',        href: '/bill-calculator',  label: 'Bill Simulator' },
      { id: 'deep-link-builder', href: '/deep-link-builder', label: 'Deep-link Builder' },
      { id: 'tariff-fit-matrix', href: '/tariff-fit-matrix', label: 'Tariff Fit Matrix' },
      { id: 'outgoing-tracker', href: '/tariffs/outgoing', label: 'Outgoing Rate Tracker' },
    ],
  },
  {
    id: 'tariff-ref',
    label: 'Tariff Reference',
    type: 'dropdown',
    children: [
      { id: 'ref-agile',                  href: '/tariffs/agile',                  label: 'Agile Octopus' },
      { id: 'ref-tracker',                href: '/tariffs/tracker',                label: 'Octopus Tracker' },
      { id: 'ref-intelligent',            href: '/tariffs/intelligent',            label: 'Intelligent Octopus Go' },
      { id: 'ref-intelligent-ocpp',       href: '/tariffs/intelligent-ocpp',       label: 'IO Go — OCPP Diagnostics' },
      { id: 'ref-intelligent-vehicles',   href: '/tariffs/intelligent-vehicles',   label: 'IO Go — Vehicle Checker' },
      { id: 'ref-intelligent-onboarding', href: '/tariffs/intelligent-onboarding', label: 'IO Go — Onboarding Guide' },
      { id: 'ref-flux',                   href: '/tariffs/flux',                   label: 'Flux' },
      { id: 'ref-cosy',                   href: '/tariffs/cosy',                   label: 'Cosy Octopus' },
      { id: 'ref-comparison',             href: '/tariffs/comparison',             label: 'Compare All Tariffs' },
      { id: 'eligibility',                href: '/eligibility',                    label: 'Tariff Eligibility Checker' },
    ],
  },
  {
    id: 'reference',
    label: 'Knowledge',
    type: 'dropdown',
    children: [
      { id: 'knowledge-base', href: '/knowledge-base', label: 'Knowledge Base' },
      { id: 'release-notes', href: '/release-notes', label: 'Release Notes' },
      { id: 'terminology', href: '/terminology', label: 'Terminology Glossary' },
      { id: 'system-health', href: '/system-health', label: 'System Health' },
    ],
  },
];

export default function Header({ onOpenSearch }) {
  const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openDropdown,   setOpenDropdown]   = useState(null);
  const dropdownRefs = useRef({});
  const location = useLocation();

  useEffect(() => {
    function handleClickOutside(e) {
      const clickedInsideAny = Object.values(dropdownRefs.current).some(
        ref => ref && ref.contains(e.target)
      );
      if (!clickedInsideAny) setOpenDropdown(null);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    function handleEscape(e) {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
        setOpenDropdown(null);
      }
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
    setOpenDropdown(null);
  }, [location.pathname]);

  const navLinkClass = ({ isActive }) =>
    `px-3 py-2 rounded-md text-sm font-medium hover:text-pink-500 ${isActive ? 'text-pink-500 font-bold' : 'text-white'}`;

  function renderDesktopItem(item) {
    if (item.type === 'navlink') {
      return (
        <NavLink key={item.id} to={item.href} end={item.end} className={navLinkClass}>
          {item.label}
        </NavLink>
      );
    }
    if (item.type === 'dropdown') {
      const isOpen = openDropdown === item.id;
      return (
        <div
          key={item.id}
          className="relative"
          ref={el => { dropdownRefs.current[item.id] = el; }}
        >
          <button
            onClick={() => setOpenDropdown(isOpen ? null : item.id)}
            type="button"
            className="px-3 py-2 rounded-md text-sm font-medium text-white hover:text-pink-500 flex items-center cursor-pointer"
            aria-expanded={isOpen}
            aria-haspopup="true"
          >
            <span>{item.label}</span>
            <svg
              className={`ml-1 h-5 w-5 transform transition-transform ${isOpen ? 'rotate-180' : ''}`}
              xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"
            >
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
          {isOpen && (
            <div className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg py-1 bg-gray-900 ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
              {item.children.map(child => (
                <Link key={child.id} to={child.href} className="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-800">
                  {child.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      );
    }
    return (
      <Link key={item.id} to={item.href} className="px-3 py-2 rounded-md text-sm font-medium text-white hover:text-pink-500">
        {item.label}
      </Link>
    );
  }

  return (
    <nav
      className="sticky top-0 z-50 shadow-sm"
      style={{ backgroundColor: 'rgba(156, 111, 255, 0.26)', backdropFilter: 'blur(8px)' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo — imported as asset so it resolves correctly under chrome-extension:// */}
          <div className="flex-shrink-0">
            <Link to="/" title="Home">
              <img src={logo} alt="Octopus Energy Smart Products" className="h-8 w-auto" />
            </Link>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex md:items-center md:space-x-4">
            {NAV_ITEMS.map(renderDesktopItem)}

            {/* Search button */}
            <button
              type="button"
              onClick={onOpenSearch}
              title="Search (Ctrl+K)"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-gray-300 hover:text-white border border-white/10 hover:border-white/25 text-xs transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <kbd className="text-xs">{isMac ? '⌘K' : 'Ctrl+K'}</kbd>
            </button>

            {/* Settings gear — links to the extension settings page */}
            <NavLink
              to="/settings"
              title="Extension Settings"
              className={({ isActive }) =>
                `flex items-center p-1.5 rounded-lg border transition-colors ${
                  isActive
                    ? 'text-pink-400 border-pink-400/40'
                    : 'text-gray-300 hover:text-white border-white/10 hover:border-white/25'
                }`
              }
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </NavLink>
          </div>

          {/* Mobile menu button */}
          <div className="flex md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              type="button"
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-300 hover:text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-white"
              aria-controls="mobile-menu"
              aria-expanded={mobileMenuOpen}
            >
              <span className="sr-only">Open main menu</span>
              {mobileMenuOpen ? (
                <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden" id="mobile-menu">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            {NAV_ITEMS.map(item => {
              if (item.type === 'dropdown') {
                return (
                  <div key={item.id}>
                    <span role="group" aria-label={item.label} className="block px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider text-gray-300">{item.label}</span>
                    <div className="border-t border-gray-700 my-1" />
                    {item.children.map(child => (
                      <Link key={child.id} to={child.href} className="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-800 rounded-md">
                        {child.label}
                      </Link>
                    ))}
                    <div className="border-t border-gray-700 my-1" />
                  </div>
                );
              }
              return (
                <Link key={item.id} to={item.href} className="block px-3 py-2 rounded-md text-base font-medium text-white hover:text-pink-500">
                  {item.label}
                </Link>
              );
            })}
            <Link to="/settings" className="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-white">
              ⚙ Settings
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
