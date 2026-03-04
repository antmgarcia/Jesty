/**
 * JestyCharacters — Shared SVG symbol definitions for Jesty expressions and accessories.
 * Injects all face-* and acc-* symbols into the DOM so any page can reference them via <use>.
 *
 * Usage: Include this script, then call JestyCharacters.init() on DOMContentLoaded.
 */
const JestyCharacters = (function () {
  'use strict';

  const SVG_SYMBOLS = `
      <!-- Smug face - arms crossed, leaning back -->
      <symbol id="face-smug" viewBox="-15 -10 150 140">
        <defs>
          <clipPath id="clip-smug">
            <path d="M48 18 C30 18, 22 30, 24 48 C25 60, 20 72, 22 84 C24 96, 38 104, 60 106 C82 108, 98 98, 100 84 C102 72, 96 60, 94 48 C92 32, 82 18, 72 18 Z"/>
          </clipPath>
        </defs>
        <path d="M48 18 C30 18, 22 30, 24 48 C25 60, 20 72, 22 84 C24 96, 38 104, 60 106 C82 108, 98 98, 100 84 C102 72, 96 60, 94 48 C92 32, 82 18, 72 18 Z" fill="#EBF34F"/>
        <g clip-path="url(#clip-smug)">
          <ellipse cx="60" cy="90" rx="30" ry="18" fill="#8A9618" opacity="0.15"/>
          <ellipse cx="58" cy="30" rx="22" ry="14" fill="#F8FBCE" opacity="0.22"/>
        </g>
        <path d="M30 56 C18 52, 10 60, 16 70 C22 80, 48 72, 62 68" stroke="#C8D132" stroke-width="7" fill="none" stroke-linecap="round"/>
        <ellipse cx="62" cy="68" rx="7" ry="5" fill="#C8D132" transform="rotate(-20, 62, 68)"/>
        <path d="M90 56 C102 54, 108 64, 100 72 C92 80, 66 74, 56 72" stroke="#C8D132" stroke-width="7" fill="none" stroke-linecap="round"/>
        <ellipse cx="56" cy="72" rx="7" ry="5" fill="#C8D132" transform="rotate(20, 56, 72)"/>
        <path d="M44 102 C40 108, 36 114, 38 118" stroke="#C8D132" stroke-width="7" fill="none" stroke-linecap="round"/>
        <ellipse cx="38" cy="118" rx="7" ry="4" fill="#C8D132" transform="rotate(-10, 38, 118)"/>
        <path d="M72 104 C76 110, 80 114, 78 118" stroke="#C8D132" stroke-width="7" fill="none" stroke-linecap="round"/>
        <ellipse cx="78" cy="118" rx="7" ry="4" fill="#C8D132" transform="rotate(10, 78, 118)"/>
        <ellipse cx="46" cy="50" rx="8" ry="4" fill="#FFFFFF"/>
        <circle cx="48" cy="50" r="3" fill="#2D2A26"/>
        <circle cx="49" cy="49" r="1.2" fill="#FFFFFF"/>
        <ellipse cx="72" cy="50" rx="8" ry="4" fill="#FFFFFF"/>
        <circle cx="74" cy="50" r="3" fill="#2D2A26"/>
        <circle cx="75" cy="49" r="1.2" fill="#FFFFFF"/>
        <path d="M38 42 C42 40, 50 40, 54 42" stroke="#2D2A26" stroke-width="3.5" fill="none" stroke-linecap="round"/>
        <path d="M64 38 C68 34, 76 34, 80 38" stroke="#2D2A26" stroke-width="3.5" fill="none" stroke-linecap="round"/>
        <path d="M48 64 C52 62, 58 62, 68 68" stroke="#2D2A26" stroke-width="3" fill="none" stroke-linecap="round"/>
      </symbol>

      <!-- Suspicious - hand on chin, side-eyeing -->
      <symbol id="face-suspicious" viewBox="-15 -10 150 140">
        <defs>
          <clipPath id="clip-suspicious">
            <path d="M52 14 C34 14, 26 26, 28 42 C29 54, 26 66, 28 80 C30 94, 42 106, 60 108 C78 110, 88 98, 90 82 C92 68, 90 54, 88 42 C86 26, 74 14, 62 14 Z" transform="rotate(6, 60, 60)"/>
          </clipPath>
        </defs>
        <path d="M52 14 C34 14, 26 26, 28 42 C29 54, 26 66, 28 80 C30 94, 42 106, 60 108 C78 110, 88 98, 90 82 C92 68, 90 54, 88 42 C86 26, 74 14, 62 14 Z" fill="#EBF34F" transform="rotate(6, 60, 60)"/>
        <g clip-path="url(#clip-suspicious)">
          <ellipse cx="62" cy="92" rx="28" ry="16" fill="#8A9618" opacity="0.15" transform="rotate(6, 60, 60)"/>
          <ellipse cx="56" cy="28" rx="20" ry="14" fill="#F8FBCE" opacity="0.22" transform="rotate(6, 60, 60)"/>
        </g>
        <path d="M44 104 C40 110, 38 116, 40 118" stroke="#C8D132" stroke-width="7" fill="none" stroke-linecap="round"/>
        <ellipse cx="40" cy="118" rx="7" ry="4" fill="#C8D132" transform="rotate(-10, 40, 118)"/>
        <path d="M72 106 C74 112, 76 116, 74 118" stroke="#C8D132" stroke-width="7" fill="none" stroke-linecap="round"/>
        <ellipse cx="74" cy="118" rx="7" ry="4" fill="#C8D132" transform="rotate(5, 74, 118)"/>
        <ellipse cx="46" cy="50" rx="7" ry="5" fill="#FFFFFF"/>
        <circle cx="49" cy="50" r="3.5" fill="#2D2A26"/>
        <circle cx="50" cy="49" r="1.2" fill="#FFFFFF"/>
        <path d="M38 46 C42 44, 50 44, 54 46 L54 50 C50 48, 42 48, 38 50 Z" fill="#EBF34F"/>
        <ellipse cx="72" cy="48" rx="8" ry="6" fill="#FFFFFF"/>
        <circle cx="75" cy="49" r="4" fill="#2D2A26"/>
        <circle cx="76" cy="48" r="1.3" fill="#FFFFFF"/>
        <path d="M63 44 C67 42, 77 42, 81 44 L81 47 C77 45, 67 45, 63 47 Z" fill="#EBF34F"/>
        <path d="M36 42 C40 44, 50 46, 54 44" stroke="#2D2A26" stroke-width="3.5" fill="none" stroke-linecap="round"/>
        <path d="M64 40 C68 38, 76 38, 80 42" stroke="#2D2A26" stroke-width="3.5" fill="none" stroke-linecap="round"/>
        <path d="M48 62 C54 64, 62 64, 68 61" stroke="#2D2A26" stroke-width="3" fill="none" stroke-linecap="round"/>
        <path d="M32 54 C20 50, 10 56, 14 66 C18 76, 38 72, 48 66" stroke="#C8D132" stroke-width="7" fill="none" stroke-linecap="round"/>
        <ellipse cx="48" cy="66" rx="7" ry="5" fill="#C8D132" transform="rotate(30, 48, 66)"/>
        <path d="M88 58 C100 62, 108 74, 104 86 C102 92, 98 96, 96 100" stroke="#C8D132" stroke-width="7" fill="none" stroke-linecap="round"/>
        <ellipse cx="96" cy="100" rx="7" ry="5" fill="#C8D132" transform="rotate(-5, 96, 100)"/>
      </symbol>

      <!-- Yikes - hands up shocked -->
      <symbol id="face-yikes" viewBox="-15 -10 150 140">
        <defs>
          <clipPath id="clip-yikes">
            <path d="M50 10 C36 10, 32 22, 34 38 C35 50, 34 62, 35 76 C36 90, 42 102, 60 104 C78 106, 84 92, 85 76 C86 62, 85 50, 86 38 C88 22, 82 10, 70 10 Z"/>
          </clipPath>
        </defs>
        <path d="M50 10 C36 10, 32 22, 34 38 C35 50, 34 62, 35 76 C36 90, 42 102, 60 104 C78 106, 84 92, 85 76 C86 62, 85 50, 86 38 C88 22, 82 10, 70 10 Z" fill="#EBF34F"/>
        <g clip-path="url(#clip-yikes)">
          <ellipse cx="60" cy="90" rx="24" ry="16" fill="#8A9618" opacity="0.15"/>
          <ellipse cx="58" cy="20" rx="18" ry="14" fill="#F8FBCE" opacity="0.22"/>
        </g>
        <path d="M36 42 C22 34, 8 22, 4 14 C2 10, 6 6, 12 10" stroke="#C8D132" stroke-width="7" fill="none" stroke-linecap="round"/>
        <ellipse cx="12" cy="10" rx="7" ry="5" fill="#C8D132" transform="rotate(-30, 12, 10)"/>
        <path d="M84 42 C98 34, 112 22, 116 14 C118 10, 114 6, 108 10" stroke="#C8D132" stroke-width="7" fill="none" stroke-linecap="round"/>
        <ellipse cx="108" cy="10" rx="7" ry="5" fill="#C8D132" transform="rotate(30, 108, 10)"/>
        <path d="M46 100 C42 106, 38 114, 40 118" stroke="#C8D132" stroke-width="7" fill="none" stroke-linecap="round"/>
        <ellipse cx="40" cy="118" rx="7" ry="4" fill="#C8D132" transform="rotate(-10, 40, 118)"/>
        <path d="M74 100 C78 106, 82 114, 80 118" stroke="#C8D132" stroke-width="7" fill="none" stroke-linecap="round"/>
        <ellipse cx="80" cy="118" rx="7" ry="4" fill="#C8D132" transform="rotate(10, 80, 118)"/>
        <circle cx="48" cy="44" r="10" fill="#FFFFFF"/>
        <circle cx="48" cy="46" r="3" fill="#2D2A26"/>
        <circle cx="50" cy="44" r="1.5" fill="#FFFFFF"/>
        <circle cx="72" cy="44" r="10" fill="#FFFFFF"/>
        <circle cx="72" cy="46" r="3" fill="#2D2A26"/>
        <circle cx="74" cy="44" r="1.5" fill="#FFFFFF"/>
        <path d="M36 28 C40 24, 52 24, 56 28" stroke="#2D2A26" stroke-width="3.5" fill="none" stroke-linecap="round"/>
        <path d="M64 28 C68 24, 78 24, 82 28" stroke="#2D2A26" stroke-width="3.5" fill="none" stroke-linecap="round"/>
        <rect x="44" y="60" width="32" height="12" rx="3" fill="#FFFFFF" stroke="#2D2A26" stroke-width="2.5"/>
        <line x1="50" y1="60" x2="50" y2="72" stroke="#2D2A26" stroke-width="1.8"/>
        <line x1="56" y1="60" x2="56" y2="72" stroke="#2D2A26" stroke-width="1.8"/>
        <line x1="62" y1="60" x2="62" y2="72" stroke="#2D2A26" stroke-width="1.8"/>
        <line x1="68" y1="60" x2="68" y2="72" stroke="#2D2A26" stroke-width="1.8"/>
        <path d="M90 30 C90 26, 94 22, 94 28 C94 32, 90 34, 90 30 Z" fill="#87CEEB"/>
        <path d="M96 42 C96 39, 99 36, 99 41 C99 44, 96 45, 96 42 Z" fill="#87CEEB" opacity="0.8"/>
        <path d="M24 24 C24 20, 28 16, 28 22 C28 26, 24 28, 24 24 Z" fill="#87CEEB"/>
        <path d="M18 38 C18 35, 21 32, 21 37 C21 40, 18 41, 18 38 Z" fill="#87CEEB" opacity="0.7"/>
        <path d="M60 4 C60 1, 63 -2, 63 3 C63 6, 60 7, 60 4 Z" fill="#87CEEB" opacity="0.6"/>
      </symbol>

      <!-- Eyeroll - arms crossed, annoyed -->
      <symbol id="face-eyeroll" viewBox="-15 -10 150 140">
        <defs>
          <clipPath id="clip-eyeroll">
            <path d="M38 22 C18 24, 10 40, 14 58 C16 70, 14 82, 20 94 C28 108, 50 112, 68 110 C86 108, 104 100, 106 86 C108 72, 104 58, 100 46 C96 32, 82 22, 62 20 Z"/>
          </clipPath>
        </defs>
        <path d="M38 22 C18 24, 10 40, 14 58 C16 70, 14 82, 20 94 C28 108, 50 112, 68 110 C86 108, 104 100, 106 86 C108 72, 104 58, 100 46 C96 32, 82 22, 62 20 Z" fill="#EBF34F"/>
        <g clip-path="url(#clip-eyeroll)">
          <ellipse cx="56" cy="96" rx="34" ry="18" fill="#8A9618" opacity="0.15"/>
          <ellipse cx="52" cy="34" rx="26" ry="16" fill="#F8FBCE" opacity="0.22"/>
        </g>
        <path d="M20 60 C8 56, 0 64, 6 74 C12 84, 40 78, 56 74" stroke="#C8D132" stroke-width="7" fill="none" stroke-linecap="round"/>
        <ellipse cx="56" cy="74" rx="7" ry="5" fill="#C8D132" transform="rotate(-15, 56, 74)"/>
        <path d="M100 60 C112 58, 118 68, 112 76 C106 84, 78 78, 64 76" stroke="#C8D132" stroke-width="7" fill="none" stroke-linecap="round"/>
        <ellipse cx="64" cy="76" rx="7" ry="5" fill="#C8D132" transform="rotate(15, 64, 76)"/>
        <path d="M42 108 C38 112, 34 116, 36 118" stroke="#C8D132" stroke-width="7" fill="none" stroke-linecap="round"/>
        <ellipse cx="36" cy="118" rx="7" ry="4" fill="#C8D132" transform="rotate(-10, 36, 118)"/>
        <path d="M76 108 C80 112, 84 116, 82 118" stroke="#C8D132" stroke-width="7" fill="none" stroke-linecap="round"/>
        <ellipse cx="82" cy="118" rx="7" ry="4" fill="#C8D132" transform="rotate(10, 82, 118)"/>
        <circle cx="48" cy="50" r="8" fill="#FFFFFF"/>
        <circle cx="48" cy="44" r="4" fill="#2D2A26"/>
        <circle cx="49" cy="43" r="1.3" fill="#FFFFFF"/>
        <circle cx="76" cy="50" r="8" fill="#FFFFFF"/>
        <circle cx="76" cy="44" r="4" fill="#2D2A26"/>
        <circle cx="77" cy="43" r="1.3" fill="#FFFFFF"/>
        <path d="M38 38 C42 36, 52 36, 56 38" stroke="#2D2A26" stroke-width="3.5" fill="none" stroke-linecap="round"/>
        <path d="M66 38 C70 36, 80 36, 84 38" stroke="#2D2A26" stroke-width="3.5" fill="none" stroke-linecap="round"/>
        <path d="M50 66 L72 66" stroke="#2D2A26" stroke-width="3" fill="none" stroke-linecap="round"/>
      </symbol>

      <!-- Disappointed - droopy sad -->
      <symbol id="face-disappointed" viewBox="-15 -10 150 140">
        <defs>
          <clipPath id="clip-disappointed">
            <path d="M44 38 C30 40, 26 52, 28 64 C30 76, 32 88, 40 98 C48 106, 64 108, 76 98 C84 90, 88 76, 90 64 C92 52, 86 40, 74 38 Z"/>
          </clipPath>
        </defs>
        <path d="M44 38 C30 40, 26 52, 28 64 C30 76, 32 88, 40 98 C48 106, 64 108, 76 98 C84 90, 88 76, 90 64 C92 52, 86 40, 74 38 Z" fill="#EBF34F"/>
        <g clip-path="url(#clip-disappointed)">
          <ellipse cx="58" cy="90" rx="26" ry="16" fill="#8A9618" opacity="0.15"/>
          <ellipse cx="58" cy="46" rx="20" ry="12" fill="#F8FBCE" opacity="0.22"/>
        </g>
        <path d="M30 62 C18 66, 10 78, 14 90 C16 96, 18 102, 16 108" stroke="#C8D132" stroke-width="7" fill="none" stroke-linecap="round"/>
        <ellipse cx="16" cy="108" rx="7" ry="5" fill="#C8D132" transform="rotate(5, 16, 108)"/>
        <path d="M88 62 C100 66, 108 78, 104 90 C102 96, 100 102, 102 108" stroke="#C8D132" stroke-width="7" fill="none" stroke-linecap="round"/>
        <ellipse cx="102" cy="108" rx="7" ry="5" fill="#C8D132" transform="rotate(-5, 102, 108)"/>
        <path d="M48 100 C44 106, 40 114, 42 118" stroke="#C8D132" stroke-width="7" fill="none" stroke-linecap="round"/>
        <ellipse cx="42" cy="118" rx="7" ry="4" fill="#C8D132" transform="rotate(-8, 42, 118)"/>
        <path d="M70 100 C74 106, 78 114, 76 118" stroke="#C8D132" stroke-width="7" fill="none" stroke-linecap="round"/>
        <ellipse cx="76" cy="118" rx="7" ry="4" fill="#C8D132" transform="rotate(8, 76, 118)"/>
        <ellipse cx="48" cy="60" rx="7" ry="8" fill="#FFFFFF"/>
        <circle cx="48" cy="62" r="4" fill="#2D2A26"/>
        <circle cx="49" cy="61" r="1.3" fill="#FFFFFF"/>
        <ellipse cx="70" cy="60" rx="7" ry="8" fill="#FFFFFF"/>
        <circle cx="70" cy="62" r="4" fill="#2D2A26"/>
        <circle cx="71" cy="61" r="1.3" fill="#FFFFFF"/>
        <path d="M40 52 C44 54, 50 56, 54 56" stroke="#2D2A26" stroke-width="3.5" fill="none" stroke-linecap="round"/>
        <path d="M78 52 C74 54, 68 56, 64 56" stroke="#2D2A26" stroke-width="3.5" fill="none" stroke-linecap="round"/>
        <path d="M50 76 C54 80, 60 80, 68 76" stroke="#2D2A26" stroke-width="3" fill="none" stroke-linecap="round" transform="rotate(180, 59, 78)"/>
      </symbol>

      <!-- Melting - puddle blob -->
      <symbol id="face-melting" viewBox="-15 -10 150 140">
        <defs>
          <clipPath id="clip-melting">
            <path d="M20 60 C16 60, 8 72, 10 84 C12 96, 24 108, 60 110 C96 112, 108 98, 110 86 C112 74, 104 62, 100 60 C98 52, 92 36, 86 30 C78 22, 68 18, 60 20 C52 22, 42 28, 36 36 C30 44, 24 54, 22 60 Z"/>
          </clipPath>
        </defs>
        <path d="M20 60 C16 60, 8 72, 10 84 C12 96, 24 108, 60 110 C96 112, 108 98, 110 86 C112 74, 104 62, 100 60 C98 52, 92 36, 86 30 C78 22, 68 18, 60 20 C52 22, 42 28, 36 36 C30 44, 24 54, 22 60 Z" fill="#EBF34F"/>
        <g clip-path="url(#clip-melting)">
          <ellipse cx="60" cy="98" rx="40" ry="14" fill="#8A9618" opacity="0.15"/>
          <ellipse cx="58" cy="30" rx="22" ry="14" fill="#F8FBCE" opacity="0.22"/>
        </g>
        <path d="M28 86 C26 92, 24 100, 26 108 C28 114, 32 116, 34 110 C36 104, 34 94, 32 88" fill="#EBF34F"/>
        <ellipse cx="30" cy="110" rx="3" ry="2" fill="#8A9618" opacity="0.15"/>
        <path d="M86 84 C88 90, 92 98, 90 106 C88 112, 84 114, 82 108 C80 102, 82 92, 84 86" fill="#EBF34F"/>
        <ellipse cx="86" cy="108" rx="3" ry="2" fill="#8A9618" opacity="0.15"/>
        <path d="M22 68 C10 66, -2 72, 0 82 C2 88, 6 90, 4 94" stroke="#C8D132" stroke-width="7" fill="none" stroke-linecap="round"/>
        <ellipse cx="4" cy="94" rx="7" ry="5" fill="#C8D132" transform="rotate(-25, 4, 94)"/>
        <path d="M98 68 C110 66, 120 72, 118 82 C116 88, 114 90, 116 94" stroke="#C8D132" stroke-width="7" fill="none" stroke-linecap="round"/>
        <ellipse cx="116" cy="94" rx="7" ry="5" fill="#C8D132" transform="rotate(25, 116, 94)"/>
        <circle cx="46" cy="50" r="8" fill="#FFFFFF"/>
        <path d="M46 46 C50 46, 50 50, 46 50 C43 50, 43 47, 46 47 C48 47, 48 49, 46 49" stroke="#2D2A26" stroke-width="2" fill="none" stroke-linecap="round"/>
        <circle cx="72" cy="50" r="8" fill="#FFFFFF"/>
        <path d="M72 46 C76 46, 76 50, 72 50 C69 50, 69 47, 72 47 C74 47, 74 49, 72 49" stroke="#2D2A26" stroke-width="2" fill="none" stroke-linecap="round"/>
        <path d="M36 40 C40 38, 50 38, 54 40" stroke="#2D2A26" stroke-width="3.5" fill="none" stroke-linecap="round"/>
        <path d="M64 40 C68 38, 78 38, 82 40" stroke="#2D2A26" stroke-width="3.5" fill="none" stroke-linecap="round"/>
        <path d="M42 64 C46 60, 50 68, 55 62 C60 56, 64 66, 70 62 C74 58, 76 64, 78 62" stroke="#2D2A26" stroke-width="2.8" fill="none" stroke-linecap="round"/>
        <path d="M34 32 C34 28, 38 24, 38 30 C38 34, 34 36, 34 32 Z" fill="#87CEEB"/>
        <path d="M82 28 C82 24, 86 20, 86 26 C86 30, 82 32, 82 28 Z" fill="#87CEEB"/>
      </symbol>

      <!-- Dead - flat dramatic -->
      <symbol id="face-dead" viewBox="-15 -10 150 140">
        <defs>
          <clipPath id="clip-dead">
            <path d="M46 22 C30 26, 24 40, 26 56 C27 66, 24 78, 28 90 C32 104, 46 112, 60 114 C74 112, 86 104, 88 90 C90 78, 88 66, 86 56 C84 40, 76 26, 66 22 Z" transform="rotate(8, 60, 68)"/>
          </clipPath>
        </defs>
        <path d="M46 22 C30 26, 24 40, 26 56 C27 66, 24 78, 28 90 C32 104, 46 112, 60 114 C74 112, 86 104, 88 90 C90 78, 88 66, 86 56 C84 40, 76 26, 66 22 Z" fill="#EBF34F" transform="rotate(8, 60, 68)"/>
        <g clip-path="url(#clip-dead)">
          <ellipse cx="60" cy="96" rx="28" ry="18" fill="#8A9618" opacity="0.15" transform="rotate(8, 60, 68)"/>
          <ellipse cx="56" cy="36" rx="22" ry="14" fill="#F8FBCE" opacity="0.22" transform="rotate(8, 60, 68)"/>
        </g>
        <path d="M32 62 C26 70, 22 82, 24 94 C25 100, 26 106, 24 112" stroke="#C8D132" stroke-width="7" fill="none" stroke-linecap="round"/>
        <ellipse cx="24" cy="112" rx="7" ry="5" fill="#C8D132" transform="rotate(5, 24, 112)"/>
        <path d="M88 58 C94 66, 98 78, 96 90 C95 96, 96 104, 98 112" stroke="#C8D132" stroke-width="7" fill="none" stroke-linecap="round"/>
        <ellipse cx="98" cy="112" rx="7" ry="5" fill="#C8D132" transform="rotate(-5, 98, 112)"/>
        <path d="M48 110 C44 114, 42 118, 44 122" stroke="#C8D132" stroke-width="7" fill="none" stroke-linecap="round"/>
        <ellipse cx="44" cy="122" rx="7" ry="4" fill="#C8D132" transform="rotate(-8, 44, 122)"/>
        <path d="M72 110 C76 114, 78 118, 76 122" stroke="#C8D132" stroke-width="7" fill="none" stroke-linecap="round"/>
        <ellipse cx="76" cy="122" rx="7" ry="4" fill="#C8D132" transform="rotate(8, 76, 122)"/>
        <path d="M40 52 C44 58, 50 58, 54 52" stroke="#2D2A26" stroke-width="3.5" fill="none" stroke-linecap="round"/>
        <path d="M64 50 C68 56, 74 56, 78 50" stroke="#2D2A26" stroke-width="3.5" fill="none" stroke-linecap="round"/>
        <path d="M40 46 C44 44, 50 44, 54 46" stroke="#2D2A26" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <path d="M64 44 C68 42, 74 42, 78 44" stroke="#2D2A26" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <ellipse cx="58" cy="70" rx="8" ry="6" fill="#2D2A26"/>
        <path d="M58 14 C56 8, 52 2, 54 -4" stroke="#F5F9A8" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.6"/>
        <path d="M52 -6 C48 -8, 46 -4, 50 -2 C54 0, 58 -4, 62 -2 C66 0, 68 -4, 64 -6 C60 -8, 56 -6, 52 -6 Z" fill="#F5F9A8" opacity="0.45"/>
        <circle cx="55" cy="-4" r="1" fill="#2D2A26" opacity="0.35"/>
        <circle cx="61" cy="-4" r="1" fill="#2D2A26" opacity="0.35"/>
        <path d="M55 -1 C57 0, 59 0, 61 -1" stroke="#2D2A26" stroke-width="0.8" fill="none" opacity="0.3"/>
        <path d="M34 18 L35 14 L36 18 L40 17 L36 18 L37 22 L35 18 L32 19 Z" fill="#FFD93D" opacity="0.7"/>
        <path d="M78 12 L79 8 L80 12 L84 11 L80 12 L81 16 L79 12 L76 13 Z" fill="#FFD93D" opacity="0.6"/>
        <path d="M56 8 L57 5 L58 8 L61 7 L58 8 L59 11 L57 8 L54 9 Z" fill="#FFD93D" opacity="0.5"/>
      </symbol>

      <!-- Thinking - curious lean -->
      <symbol id="face-thinking" viewBox="-15 -10 150 140">
        <defs>
          <clipPath id="clip-thinking">
            <path d="M52 16 C36 18, 28 30, 30 46 C31 56, 26 68, 28 82 C30 96, 44 106, 62 108 C80 110, 92 98, 94 82 C96 68, 92 56, 90 46 C88 30, 76 16, 64 16 Z" transform="rotate(-5, 60, 60)"/>
          </clipPath>
        </defs>
        <path d="M52 16 C36 18, 28 30, 30 46 C31 56, 26 68, 28 82 C30 96, 44 106, 62 108 C80 110, 92 98, 94 82 C96 68, 92 56, 90 46 C88 30, 76 16, 64 16 Z" fill="#EBF34F" transform="rotate(-5, 60, 60)"/>
        <g clip-path="url(#clip-thinking)">
          <ellipse cx="60" cy="92" rx="28" ry="16" fill="#8A9618" opacity="0.15" transform="rotate(-5, 60, 60)"/>
          <ellipse cx="56" cy="30" rx="22" ry="14" fill="#F8FBCE" opacity="0.22" transform="rotate(-5, 60, 60)"/>
        </g>
        <path d="M34 56 C22 54, 12 58, 16 66 C20 74, 36 72, 46 66" stroke="#C8D132" stroke-width="7" fill="none" stroke-linecap="round"/>
        <ellipse cx="46" cy="66" rx="7" ry="5" fill="#C8D132" transform="rotate(25, 46, 66)"/>
        <path d="M90 58 C100 62, 106 72, 102 84 C100 90, 96 96, 98 102" stroke="#C8D132" stroke-width="7" fill="none" stroke-linecap="round"/>
        <ellipse cx="98" cy="102" rx="7" ry="5" fill="#C8D132" transform="rotate(-10, 98, 102)"/>
        <path d="M46 104 C42 110, 38 116, 40 118" stroke="#C8D132" stroke-width="7" fill="none" stroke-linecap="round"/>
        <ellipse cx="40" cy="118" rx="7" ry="4" fill="#C8D132" transform="rotate(-10, 40, 118)"/>
        <path d="M72 106 C76 112, 80 116, 78 118" stroke="#C8D132" stroke-width="7" fill="none" stroke-linecap="round"/>
        <ellipse cx="78" cy="118" rx="7" ry="4" fill="#C8D132" transform="rotate(10, 78, 118)"/>
        <circle cx="48" cy="48" r="8" fill="#FFFFFF"/>
        <circle cx="51" cy="44" r="4" fill="#2D2A26"/>
        <circle cx="52" cy="43" r="1.3" fill="#FFFFFF"/>
        <circle cx="72" cy="48" r="8" fill="#FFFFFF"/>
        <circle cx="75" cy="44" r="4" fill="#2D2A26"/>
        <circle cx="76" cy="43" r="1.3" fill="#FFFFFF"/>
        <path d="M38 38 C42 36, 52 36, 56 38" stroke="#2D2A26" stroke-width="3.5" fill="none" stroke-linecap="round"/>
        <path d="M64 32 C68 28, 76 28, 80 34" stroke="#2D2A26" stroke-width="3.5" fill="none" stroke-linecap="round"/>
        <circle cx="58" cy="64" r="4.5" fill="#2D2A26"/>
        <circle cx="96" cy="24" r="8" fill="#E0E0E0" stroke="#BDBDBD" stroke-width="1.2"/>
        <circle cx="88" cy="36" r="4" fill="#E8E8E8" stroke="#BDBDBD" stroke-width="1"/>
        <circle cx="84" cy="42" r="2.2" fill="#EEEEEE" stroke="#BDBDBD" stroke-width="0.8"/>
      </symbol>

      <!-- Happy - arms up celebrating -->
      <symbol id="face-happy" viewBox="-15 -10 150 140">
        <defs>
          <clipPath id="clip-happy">
            <path d="M44 12 C22 14, 12 30, 14 50 C15 62, 12 76, 16 90 C22 106, 42 112, 60 114 C78 112, 98 106, 104 90 C108 76, 105 62, 106 50 C108 30, 98 14, 76 12 Z"/>
          </clipPath>
        </defs>
        <path d="M44 12 C22 14, 12 30, 14 50 C15 62, 12 76, 16 90 C22 106, 42 112, 60 114 C78 112, 98 106, 104 90 C108 76, 105 62, 106 50 C108 30, 98 14, 76 12 Z" fill="#EBF34F"/>
        <g clip-path="url(#clip-happy)">
          <ellipse cx="60" cy="98" rx="36" ry="18" fill="#8A9618" opacity="0.15"/>
          <ellipse cx="56" cy="24" rx="28" ry="16" fill="#F8FBCE" opacity="0.22"/>
        </g>
        <path d="M18 52 C6 40, -4 24, -2 12 C0 6, 6 4, 8 10" stroke="#C8D132" stroke-width="7" fill="none" stroke-linecap="round"/>
        <ellipse cx="8" cy="10" rx="7" ry="5" fill="#C8D132" transform="rotate(-35, 8, 10)"/>
        <path d="M102 52 C114 40, 124 24, 122 12 C120 6, 114 4, 112 10" stroke="#C8D132" stroke-width="7" fill="none" stroke-linecap="round"/>
        <ellipse cx="112" cy="10" rx="7" ry="5" fill="#C8D132" transform="rotate(35, 112, 10)"/>
        <path d="M44 110 C38 114, 34 116, 36 118" stroke="#C8D132" stroke-width="7" fill="none" stroke-linecap="round"/>
        <ellipse cx="36" cy="118" rx="7" ry="4" fill="#C8D132" transform="rotate(-10, 36, 118)"/>
        <path d="M76 110 C82 114, 86 116, 84 118" stroke="#C8D132" stroke-width="7" fill="none" stroke-linecap="round"/>
        <ellipse cx="84" cy="118" rx="7" ry="4" fill="#C8D132" transform="rotate(10, 84, 118)"/>
        <circle cx="46" cy="48" r="9" fill="#FFFFFF"/>
        <circle cx="47" cy="49" r="4.5" fill="#2D2A26"/>
        <circle cx="44" cy="45" r="2" fill="#FFFFFF"/>
        <circle cx="49" cy="48" r="1" fill="#FFFFFF"/>
        <circle cx="74" cy="48" r="9" fill="#FFFFFF"/>
        <circle cx="75" cy="49" r="4.5" fill="#2D2A26"/>
        <circle cx="72" cy="45" r="2" fill="#FFFFFF"/>
        <circle cx="77" cy="48" r="1" fill="#FFFFFF"/>
        <path d="M36 36 C40 32, 50 32, 54 36" stroke="#2D2A26" stroke-width="3.5" fill="none" stroke-linecap="round"/>
        <path d="M66 36 C70 32, 78 32, 82 36" stroke="#2D2A26" stroke-width="3.5" fill="none" stroke-linecap="round"/>
        <ellipse cx="34" cy="58" rx="8" ry="5" fill="#FF8FA3" opacity="0.6"/>
        <ellipse cx="86" cy="58" rx="8" ry="5" fill="#FF8FA3" opacity="0.6"/>
        <path d="M44 64 C50 72, 62 74, 76 64" stroke="#2D2A26" stroke-width="3" fill="none" stroke-linecap="round"/>
        <path d="M6 36 L8 30 L10 36 L16 34 L10 36 L12 42 L8 36 L4 38 Z" fill="#FFD93D"/>
        <path d="M110 32 L112 26 L114 32 L120 30 L114 32 L116 38 L112 32 L108 34 Z" fill="#FFD93D"/>
        <path d="M58 0 L59 -4 L60 0 L64 -1 L60 0 L61 4 L59 0 L56 1 Z" fill="#FFD93D"/>
        <path d="M-4 54 L-2 50 L0 54 L4 53 L0 54 L1 58 L-2 54 L-5 55 Z" fill="#FFD93D" opacity="0.7"/>
        <path d="M120 52 L122 48 L124 52 L128 51 L124 52 L125 56 L122 52 L118 53 Z" fill="#FFD93D" opacity="0.7"/>
        <path d="M26 10 L27 7 L28 10 L31 9 L28 10 L29 13 L27 10 L24 11 Z" fill="#FFD93D" opacity="0.6"/>
        <path d="M92 6 L93 3 L94 6 L97 5 L94 6 L95 9 L93 6 L90 7 Z" fill="#FFD93D" opacity="0.6"/>
        <circle cx="14" cy="20" r="2" fill="#FF8FA3" opacity="0.5"/>
        <circle cx="106" cy="16" r="2" fill="#87CEEB" opacity="0.5"/>
        <circle cx="30" cy="2" r="1.5" fill="#FFD93D" opacity="0.5"/>
        <circle cx="88" cy="-2" r="1.5" fill="#FF8FA3" opacity="0.5"/>
        <circle cx="124" cy="40" r="1.5" fill="#FFD93D" opacity="0.4"/>
        <circle cx="-6" cy="44" r="1.5" fill="#87CEEB" opacity="0.4"/>
      </symbol>

      <!-- Premium mood: Impressed - wide eyes, jaw dropped, one hand raised -->
      <symbol id="face-impressed" viewBox="-15 -10 150 140">
        <defs>
          <clipPath id="clip-impressed">
            <path d="M46 16 C28 18, 18 32, 20 50 C21 62, 18 74, 20 86 C24 100, 40 108, 60 110 C80 108, 96 100, 100 86 C102 74, 99 62, 100 50 C102 32, 92 18, 74 16 Z"/>
          </clipPath>
        </defs>
        <path d="M46 16 C28 18, 18 32, 20 50 C21 62, 18 74, 20 86 C24 100, 40 108, 60 110 C80 108, 96 100, 100 86 C102 74, 99 62, 100 50 C102 32, 92 18, 74 16 Z" fill="#EBF34F"/>
        <g clip-path="url(#clip-impressed)">
          <ellipse cx="60" cy="94" rx="32" ry="18" fill="#8A9618" opacity="0.15"/>
          <ellipse cx="58" cy="28" rx="24" ry="14" fill="#F8FBCE" opacity="0.22"/>
        </g>
        <!-- Left arm hanging relaxed -->
        <path d="M24 60 C14 64, 8 76, 14 86" stroke="#C8D132" stroke-width="7" fill="none" stroke-linecap="round"/>
        <ellipse cx="14" cy="86" rx="7" ry="5" fill="#C8D132" transform="rotate(-10, 14, 86)"/>
        <!-- Right arm raised, pointing up -->
        <path d="M96 58 C108 50, 114 36, 108 24" stroke="#C8D132" stroke-width="7" fill="none" stroke-linecap="round"/>
        <ellipse cx="108" cy="24" rx="7" ry="5" fill="#C8D132" transform="rotate(25, 108, 24)"/>
        <!-- Legs -->
        <path d="M44 106 C40 112, 38 116, 40 120" stroke="#C8D132" stroke-width="7" fill="none" stroke-linecap="round"/>
        <ellipse cx="40" cy="120" rx="7" ry="4" fill="#C8D132"/>
        <path d="M76 106 C80 112, 82 116, 80 120" stroke="#C8D132" stroke-width="7" fill="none" stroke-linecap="round"/>
        <ellipse cx="80" cy="120" rx="7" ry="4" fill="#C8D132"/>
        <!-- Wide eyes -->
        <circle cx="46" cy="50" r="11" fill="#FFFFFF"/>
        <circle cx="47" cy="51" r="5.5" fill="#2D2A26"/>
        <circle cx="44" cy="47" r="2.5" fill="#FFFFFF"/>
        <circle cx="74" cy="50" r="11" fill="#FFFFFF"/>
        <circle cx="75" cy="51" r="5.5" fill="#2D2A26"/>
        <circle cx="72" cy="47" r="2.5" fill="#FFFFFF"/>
        <!-- Raised eyebrows -->
        <path d="M34 34 C40 28, 50 28, 56 32" stroke="#2D2A26" stroke-width="3.5" fill="none" stroke-linecap="round"/>
        <path d="M64 32 C70 28, 80 28, 86 34" stroke="#2D2A26" stroke-width="3.5" fill="none" stroke-linecap="round"/>
        <!-- Open mouth (impressed O) -->
        <ellipse cx="60" cy="72" rx="8" ry="10" fill="#2D2A26"/>
        <ellipse cx="60" cy="70" rx="5" ry="4" fill="#FF6B6B" opacity="0.4"/>
      </symbol>

      <!-- Premium mood: Manic - wide eyes, both arms up, squiggly energy -->
      <symbol id="face-manic" viewBox="-15 -10 150 140">
        <defs>
          <clipPath id="clip-manic">
            <path d="M42 14 C22 18, 14 34, 18 52 C20 64, 14 78, 18 88 C24 104, 42 110, 60 112 C78 110, 96 104, 102 88 C106 78, 100 64, 102 52 C106 34, 98 18, 78 14 Z"/>
          </clipPath>
        </defs>
        <path d="M42 14 C22 18, 14 34, 18 52 C20 64, 14 78, 18 88 C24 104, 42 110, 60 112 C78 110, 96 104, 102 88 C106 78, 100 64, 102 52 C106 34, 98 18, 78 14 Z" fill="#EBF34F"/>
        <g clip-path="url(#clip-manic)">
          <ellipse cx="60" cy="96" rx="34" ry="18" fill="#8A9618" opacity="0.15"/>
          <ellipse cx="56" cy="26" rx="26" ry="14" fill="#F8FBCE" opacity="0.22"/>
        </g>
        <!-- Left arm flailing up-left -->
        <path d="M22 56 C8 42, -2 28, 4 14 C6 10, 12 8, 10 16" stroke="#C8D132" stroke-width="7" fill="none" stroke-linecap="round"/>
        <ellipse cx="10" cy="16" rx="7" ry="5" fill="#C8D132" transform="rotate(-30, 10, 16)"/>
        <!-- Right arm flailing up-right -->
        <path d="M98 56 C112 42, 122 28, 116 14 C114 10, 108 8, 110 16" stroke="#C8D132" stroke-width="7" fill="none" stroke-linecap="round"/>
        <ellipse cx="110" cy="16" rx="7" ry="5" fill="#C8D132" transform="rotate(30, 110, 16)"/>
        <!-- Legs wide -->
        <path d="M42 108 C34 114, 28 118, 30 122" stroke="#C8D132" stroke-width="7" fill="none" stroke-linecap="round"/>
        <ellipse cx="30" cy="122" rx="7" ry="4" fill="#C8D132" transform="rotate(-15, 30, 122)"/>
        <path d="M78 108 C86 114, 92 118, 90 122" stroke="#C8D132" stroke-width="7" fill="none" stroke-linecap="round"/>
        <ellipse cx="90" cy="122" rx="7" ry="4" fill="#C8D132" transform="rotate(15, 90, 122)"/>
        <!-- Uneven crazy eyes -->
        <circle cx="44" cy="48" r="10" fill="#FFFFFF"/>
        <circle cx="45" cy="49" r="5" fill="#2D2A26"/>
        <circle cx="42" cy="45" r="2" fill="#FFFFFF"/>
        <circle cx="76" cy="46" r="12" fill="#FFFFFF"/>
        <circle cx="77" cy="47" r="6" fill="#2D2A26"/>
        <circle cx="74" cy="43" r="2.5" fill="#FFFFFF"/>
        <!-- Squiggly eyebrows -->
        <path d="M32 34 C36 30, 40 34, 44 30 C48 26, 52 30, 56 28" stroke="#2D2A26" stroke-width="3" fill="none" stroke-linecap="round"/>
        <path d="M64 28 C68 30, 72 26, 76 30 C80 34, 84 30, 88 34" stroke="#2D2A26" stroke-width="3" fill="none" stroke-linecap="round"/>
        <!-- Big grin -->
        <path d="M38 68 C46 80, 74 80, 82 68" stroke="#2D2A26" stroke-width="3" fill="none" stroke-linecap="round"/>
        <path d="M42 70 C48 76, 72 76, 78 70" fill="#2D2A26"/>
        <!-- Energy sparks -->
        <path d="M-4 30 L0 26 L2 32 L6 28 Z" fill="#FFD93D" opacity="0.6"/>
        <path d="M116 28 L120 24 L122 30 L126 26 Z" fill="#FFD93D" opacity="0.6"/>
        <circle cx="4" cy="8" r="2" fill="#FFD93D" opacity="0.5"/>
        <circle cx="116" cy="6" r="2" fill="#FFD93D" opacity="0.5"/>
      </symbol>

      <!-- Premium mood: Petty - squinting, one arm pointing accusingly -->
      <symbol id="face-petty" viewBox="-15 -10 150 140">
        <defs>
          <clipPath id="clip-petty">
            <path d="M48 20 C30 20, 22 32, 24 50 C25 62, 22 74, 24 84 C26 96, 40 104, 60 106 C80 104, 94 96, 96 84 C98 74, 95 62, 96 50 C98 32, 90 20, 72 20 Z"/>
          </clipPath>
        </defs>
        <path d="M48 20 C30 20, 22 32, 24 50 C25 62, 22 74, 24 84 C26 96, 40 104, 60 106 C80 104, 94 96, 96 84 C98 74, 95 62, 96 50 C98 32, 90 20, 72 20 Z" fill="#EBF34F"/>
        <g clip-path="url(#clip-petty)">
          <ellipse cx="60" cy="90" rx="30" ry="16" fill="#8A9618" opacity="0.15"/>
          <ellipse cx="58" cy="32" rx="22" ry="12" fill="#F8FBCE" opacity="0.22"/>
        </g>
        <!-- Left arm on hip -->
        <path d="M28 60 C18 62, 14 72, 22 78 C28 82, 36 76, 38 68" stroke="#C8D132" stroke-width="7" fill="none" stroke-linecap="round"/>
        <ellipse cx="38" cy="68" rx="6" ry="5" fill="#C8D132" transform="rotate(-15, 38, 68)"/>
        <!-- Right arm pointing forward -->
        <path d="M92 56 C106 52, 118 50, 126 48" stroke="#C8D132" stroke-width="7" fill="none" stroke-linecap="round"/>
        <ellipse cx="126" cy="48" rx="7" ry="4" fill="#C8D132" transform="rotate(-5, 126, 48)"/>
        <!-- Legs -->
        <path d="M44 102 C40 108, 38 114, 40 118" stroke="#C8D132" stroke-width="7" fill="none" stroke-linecap="round"/>
        <ellipse cx="40" cy="118" rx="7" ry="4" fill="#C8D132"/>
        <path d="M72 104 C76 110, 78 114, 76 118" stroke="#C8D132" stroke-width="7" fill="none" stroke-linecap="round"/>
        <ellipse cx="76" cy="118" rx="7" ry="4" fill="#C8D132"/>
        <!-- Squinting eyes -->
        <path d="M38 52 L56 50" stroke="#2D2A26" stroke-width="4" stroke-linecap="round"/>
        <circle cx="47" cy="51" r="3" fill="#FFFFFF"/>
        <circle cx="47" cy="51" r="1.5" fill="#2D2A26"/>
        <path d="M64 50 L82 52" stroke="#2D2A26" stroke-width="4" stroke-linecap="round"/>
        <circle cx="73" cy="51" r="3" fill="#FFFFFF"/>
        <circle cx="73" cy="51" r="1.5" fill="#2D2A26"/>
        <!-- Skeptical furrowed brows -->
        <path d="M36 42 C42 38, 50 40, 54 42" stroke="#2D2A26" stroke-width="3.5" fill="none" stroke-linecap="round"/>
        <path d="M66 42 C70 40, 78 38, 84 42" stroke="#2D2A26" stroke-width="3.5" fill="none" stroke-linecap="round"/>
        <!-- Tight pursed mouth -->
        <path d="M50 68 C54 72, 66 72, 70 68" stroke="#2D2A26" stroke-width="3" fill="none" stroke-linecap="round"/>
        <circle cx="72" cy="66" r="1.5" fill="#2D2A26"/>
      </symbol>

      <!-- Pro mood: Chaotic - tilted body, tongue out, wild pose -->
      <symbol id="face-chaotic" viewBox="-15 -10 150 140">
        <defs>
          <clipPath id="clip-chaotic">
            <path d="M44 16 C24 20, 16 36, 20 54 C22 66, 16 78, 20 90 C26 106, 44 112, 62 114 C80 112, 96 106, 100 90 C104 78, 98 66, 100 54 C104 36, 96 20, 76 16 Z"/>
          </clipPath>
        </defs>
        <g transform="rotate(-8, 60, 65)">
          <path d="M44 16 C24 20, 16 36, 20 54 C22 66, 16 78, 20 90 C26 106, 44 112, 62 114 C80 112, 96 106, 100 90 C104 78, 98 66, 100 54 C104 36, 96 20, 76 16 Z" fill="#EBF34F"/>
          <g clip-path="url(#clip-chaotic)">
            <ellipse cx="62" cy="98" rx="34" ry="18" fill="#8A9618" opacity="0.15"/>
            <ellipse cx="58" cy="28" rx="24" ry="14" fill="#F8FBCE" opacity="0.22"/>
          </g>
          <!-- Arms going every which way -->
          <path d="M24 56 C8 44, -4 30, 2 18" stroke="#C8D132" stroke-width="7" fill="none" stroke-linecap="round"/>
          <ellipse cx="2" cy="18" rx="7" ry="5" fill="#C8D132" transform="rotate(-20, 2, 18)"/>
          <path d="M96 52 C112 58, 120 72, 114 84" stroke="#C8D132" stroke-width="7" fill="none" stroke-linecap="round"/>
          <ellipse cx="114" cy="84" rx="7" ry="5" fill="#C8D132" transform="rotate(30, 114, 84)"/>
          <!-- Legs -->
          <path d="M42 110 C36 116, 30 120, 32 124" stroke="#C8D132" stroke-width="7" fill="none" stroke-linecap="round"/>
          <ellipse cx="32" cy="124" rx="7" ry="4" fill="#C8D132"/>
          <path d="M78 110 C84 116, 90 118, 88 122" stroke="#C8D132" stroke-width="7" fill="none" stroke-linecap="round"/>
          <ellipse cx="88" cy="122" rx="7" ry="4" fill="#C8D132"/>
          <!-- Derpy mismatched eyes -->
          <circle cx="44" cy="48" r="10" fill="#FFFFFF"/>
          <circle cx="46" cy="52" r="5" fill="#2D2A26"/>
          <circle cx="43" cy="46" r="2" fill="#FFFFFF"/>
          <circle cx="76" cy="46" r="9" fill="#FFFFFF"/>
          <circle cx="74" cy="44" r="4.5" fill="#2D2A26"/>
          <circle cx="72" cy="42" r="2" fill="#FFFFFF"/>
          <!-- Wild eyebrows -->
          <path d="M32 34 C38 26, 48 30, 56 28" stroke="#2D2A26" stroke-width="3.5" fill="none" stroke-linecap="round"/>
          <path d="M64 28 C72 30, 82 26, 88 34" stroke="#2D2A26" stroke-width="3.5" fill="none" stroke-linecap="round"/>
          <!-- Tongue sticking out -->
          <path d="M42 68 C50 76, 70 76, 78 68" stroke="#2D2A26" stroke-width="3" fill="none" stroke-linecap="round"/>
          <path d="M52 72 C54 76, 56 82, 60 84 C64 82, 66 76, 68 72" fill="#FF6B6B"/>
        </g>
        <!-- Chaos particles -->
        <path d="M-6 36 L-2 32 L0 38 L4 34 Z" fill="#FFD93D" opacity="0.5"/>
        <path d="M120 30 L124 26 L126 32 L130 28 Z" fill="#FFD93D" opacity="0.5"/>
        <circle cx="8" cy="6" r="2.5" fill="#FF8FA3" opacity="0.5"/>
        <circle cx="112" cy="8" r="2.5" fill="#87CEEB" opacity="0.5"/>
        <circle cx="124" cy="60" r="2" fill="#FFD93D" opacity="0.4"/>
      </symbol>

      <!-- Pro mood: Dramatic - hand on forehead, swooning back -->
      <symbol id="face-dramatic" viewBox="-15 -10 150 140">
        <defs>
          <clipPath id="clip-dramatic">
            <path d="M46 18 C28 20, 20 34, 22 52 C23 64, 18 76, 22 86 C26 100, 42 108, 60 110 C78 108, 94 100, 98 86 C102 76, 97 64, 98 52 C100 34, 92 20, 74 18 Z"/>
          </clipPath>
        </defs>
        <g transform="rotate(5, 60, 65)">
          <path d="M46 18 C28 20, 20 34, 22 52 C23 64, 18 76, 22 86 C26 100, 42 108, 60 110 C78 108, 94 100, 98 86 C102 76, 97 64, 98 52 C100 34, 92 20, 74 18 Z" fill="#EBF34F"/>
          <g clip-path="url(#clip-dramatic)">
            <ellipse cx="60" cy="94" rx="32" ry="18" fill="#8A9618" opacity="0.15"/>
            <ellipse cx="56" cy="30" rx="24" ry="14" fill="#F8FBCE" opacity="0.22"/>
          </g>
          <!-- Left arm draped down dramatically -->
          <path d="M26 60 C14 68, 6 80, 12 90" stroke="#C8D132" stroke-width="7" fill="none" stroke-linecap="round"/>
          <ellipse cx="12" cy="90" rx="7" ry="5" fill="#C8D132" transform="rotate(-10, 12, 90)"/>
          <!-- Right arm on forehead -->
          <path d="M92 54 C100 44, 98 30, 86 24 C78 20, 68 22, 62 28" stroke="#C8D132" stroke-width="7" fill="none" stroke-linecap="round"/>
          <ellipse cx="62" cy="28" rx="7" ry="5" fill="#C8D132" transform="rotate(20, 62, 28)"/>
          <!-- Legs -->
          <path d="M44 106 C40 112, 38 116, 40 120" stroke="#C8D132" stroke-width="7" fill="none" stroke-linecap="round"/>
          <ellipse cx="40" cy="120" rx="7" ry="4" fill="#C8D132"/>
          <path d="M76 106 C80 112, 82 116, 80 120" stroke="#C8D132" stroke-width="7" fill="none" stroke-linecap="round"/>
          <ellipse cx="80" cy="120" rx="7" ry="4" fill="#C8D132"/>
          <!-- Closed dramatic eyes -->
          <path d="M38 50 C44 46, 52 46, 56 50" stroke="#2D2A26" stroke-width="3.5" fill="none" stroke-linecap="round"/>
          <path d="M64 50 C70 46, 78 46, 82 50" stroke="#2D2A26" stroke-width="3.5" fill="none" stroke-linecap="round"/>
          <!-- Swooning eyebrows -->
          <path d="M36 42 C42 38, 50 38, 56 42" stroke="#2D2A26" stroke-width="3" fill="none" stroke-linecap="round"/>
          <path d="M64 42 C70 38, 78 38, 84 42" stroke="#2D2A26" stroke-width="3" fill="none" stroke-linecap="round"/>
          <!-- Open gasp mouth -->
          <ellipse cx="60" cy="68" rx="10" ry="8" fill="#2D2A26"/>
          <!-- Blush -->
          <ellipse cx="34" cy="58" rx="7" ry="4" fill="#FF8FA3" opacity="0.5"/>
          <ellipse cx="86" cy="58" rx="7" ry="4" fill="#FF8FA3" opacity="0.5"/>
        </g>
        <!-- Dramatic sparkle -->
        <path d="M-2 20 L0 14 L2 20 L6 18 L2 20 L3 24 L0 20 L-3 22 Z" fill="#FFD93D" opacity="0.5"/>
        <path d="M118 16 L120 10 L122 16 L126 14 L122 16 L123 20 L120 16 L117 18 Z" fill="#FFD93D" opacity="0.5"/>
      </symbol>

      <!-- Pro mood: Tender - blushing, hands together, soft eyes -->
      <symbol id="face-tender" viewBox="-15 -10 150 140">
        <defs>
          <clipPath id="clip-tender">
            <path d="M46 18 C28 20, 20 34, 22 52 C23 64, 18 76, 22 88 C26 102, 42 108, 60 110 C78 108, 94 102, 98 88 C102 76, 97 64, 98 52 C100 34, 92 20, 74 18 Z"/>
          </clipPath>
        </defs>
        <path d="M46 18 C28 20, 20 34, 22 52 C23 64, 18 76, 22 88 C26 102, 42 108, 60 110 C78 108, 94 102, 98 88 C102 76, 97 64, 98 52 C100 34, 92 20, 74 18 Z" fill="#EBF34F"/>
        <g clip-path="url(#clip-tender)">
          <ellipse cx="60" cy="94" rx="32" ry="18" fill="#8A9618" opacity="0.15"/>
          <ellipse cx="56" cy="30" rx="24" ry="14" fill="#F8FBCE" opacity="0.22"/>
        </g>
        <!-- Arms together in front (holding hands gesture) -->
        <path d="M30 58 C24 64, 28 74, 40 78 C48 80, 52 78, 56 74" stroke="#C8D132" stroke-width="7" fill="none" stroke-linecap="round"/>
        <path d="M90 58 C96 64, 92 74, 80 78 C72 80, 68 78, 64 74" stroke="#C8D132" stroke-width="7" fill="none" stroke-linecap="round"/>
        <ellipse cx="58" cy="76" rx="8" ry="5" fill="#C8D132"/>
        <ellipse cx="62" cy="76" rx="8" ry="5" fill="#C8D132"/>
        <!-- Legs -->
        <path d="M44 106 C40 112, 38 116, 40 120" stroke="#C8D132" stroke-width="7" fill="none" stroke-linecap="round"/>
        <ellipse cx="40" cy="120" rx="7" ry="4" fill="#C8D132"/>
        <path d="M76 106 C80 112, 82 116, 80 120" stroke="#C8D132" stroke-width="7" fill="none" stroke-linecap="round"/>
        <ellipse cx="80" cy="120" rx="7" ry="4" fill="#C8D132"/>
        <!-- Soft round eyes with sparkle -->
        <circle cx="46" cy="48" r="9" fill="#FFFFFF"/>
        <circle cx="47" cy="49" r="4.5" fill="#2D2A26"/>
        <circle cx="44" cy="45" r="2.5" fill="#FFFFFF"/>
        <circle cx="49" cy="47" r="1" fill="#FFFFFF"/>
        <circle cx="74" cy="48" r="9" fill="#FFFFFF"/>
        <circle cx="75" cy="49" r="4.5" fill="#2D2A26"/>
        <circle cx="72" cy="45" r="2.5" fill="#FFFFFF"/>
        <circle cx="77" cy="47" r="1" fill="#FFFFFF"/>
        <!-- Gentle raised brows -->
        <path d="M36 36 C42 32, 50 32, 56 36" stroke="#2D2A26" stroke-width="3" fill="none" stroke-linecap="round"/>
        <path d="M64 36 C70 32, 78 32, 84 36" stroke="#2D2A26" stroke-width="3" fill="none" stroke-linecap="round"/>
        <!-- Heavy blush -->
        <ellipse cx="34" cy="58" rx="9" ry="5" fill="#FF8FA3" opacity="0.6"/>
        <ellipse cx="86" cy="58" rx="9" ry="5" fill="#FF8FA3" opacity="0.6"/>
        <!-- Small shy smile -->
        <path d="M48 66 C54 72, 66 72, 72 66" stroke="#2D2A26" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <!-- Tiny hearts -->
        <path d="M10 22 C8 18, 2 18, 2 24 C2 28, 10 34, 10 34 C10 34, 18 28, 18 24 C18 18, 12 18, 10 22 Z" fill="#FF8FA3" opacity="0.4"/>
        <path d="M108 18 C106 14, 100 14, 100 20 C100 24, 108 30, 108 30 C108 30, 116 24, 116 20 C116 14, 110 14, 108 18 Z" fill="#FF8FA3" opacity="0.4"/>
      </symbol>

      <!-- Accessory: Party Hat -->
      <symbol id="acc-party-hat" viewBox="0 0 44 30">
        <polygon points="22,0 4,28 40,28" fill="#FF6B6B"/>
        <polygon points="22,0 13,28 22,28" fill="#FF8787" opacity="0.5"/>
        <circle cx="22" cy="0" r="4" fill="#FFD93D"/>
        <line x1="10" y1="18" x2="34" y2="18" stroke="#FFD93D" stroke-width="2"/>
        <line x1="6" y1="24" x2="38" y2="24" stroke="#4ECDC4" stroke-width="2"/>
        <rect x="2" y="26" width="40" height="4" rx="2" fill="#FF6B6B"/>
      </symbol>

      <!-- Accessory: Sunglasses -->
      <symbol id="acc-sunglasses" viewBox="0 0 56 20">
        <rect x="2" y="4" width="22" height="14" rx="4" fill="#2D2A26"/>
        <rect x="32" y="4" width="22" height="14" rx="4" fill="#2D2A26"/>
        <rect x="24" y="8" width="8" height="3" rx="1.5" fill="#2D2A26"/>
        <line x1="0" y1="10" x2="2" y2="10" stroke="#2D2A26" stroke-width="2" stroke-linecap="round"/>
        <line x1="54" y1="10" x2="56" y2="10" stroke="#2D2A26" stroke-width="2" stroke-linecap="round"/>
        <rect x="4" y="6" width="8" height="4" rx="2" fill="#FFFFFF" opacity="0.15"/>
        <rect x="34" y="6" width="8" height="4" rx="2" fill="#FFFFFF" opacity="0.15"/>
      </symbol>

      <!-- Accessory: Beanie -->
      <symbol id="acc-beanie" viewBox="0 0 52 26">
        <ellipse cx="26" cy="22" rx="26" ry="8" fill="#6366F1"/>
        <path d="M4 22 C4 8, 16 0, 26 0 C36 0, 48 8, 48 22" fill="#6366F1"/>
        <path d="M4 22 C4 8, 16 0, 26 0 C36 0, 48 8, 48 22" fill="#818CF8" opacity="0.3"/>
        <rect x="0" y="18" width="52" height="8" rx="4" fill="#4F46E5"/>
        <line x1="6" y1="20" x2="6" y2="24" stroke="#6366F1" stroke-width="2"/>
        <line x1="14" y1="20" x2="14" y2="24" stroke="#6366F1" stroke-width="2"/>
        <line x1="22" y1="20" x2="22" y2="24" stroke="#6366F1" stroke-width="2"/>
        <line x1="30" y1="20" x2="30" y2="24" stroke="#6366F1" stroke-width="2"/>
        <line x1="38" y1="20" x2="38" y2="24" stroke="#6366F1" stroke-width="2"/>
        <line x1="46" y1="20" x2="46" y2="24" stroke="#6366F1" stroke-width="2"/>
        <circle cx="26" cy="0" r="5" fill="#6366F1"/>
      </symbol>

      <!-- Accessory: Monocle (Premium, L5) -->
      <symbol id="acc-monocle" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" fill="none" stroke="#C9A84C" stroke-width="2"/>
        <circle cx="12" cy="12" r="7" fill="#FFFFFF" opacity="0.2"/>
        <line x1="12" y1="21" x2="12" y2="24" stroke="#C9A84C" stroke-width="1.5" stroke-linecap="round"/>
        <circle cx="9" cy="9" r="2" fill="#FFFFFF" opacity="0.3"/>
      </symbol>

      <!-- Accessory: Crown (Premium, L8) -->
      <symbol id="acc-crown" viewBox="0 0 48 28">
        <path d="M4 24 L4 10 L12 18 L24 4 L36 18 L44 10 L44 24 Z" fill="#FFD700"/>
        <path d="M4 24 L44 24 L44 28 L4 28 Z" fill="#DAA520"/>
        <circle cx="12" cy="10" r="3" fill="#FF6B6B"/>
        <circle cx="24" cy="4" r="3" fill="#4ECDC4"/>
        <circle cx="36" cy="10" r="3" fill="#FF6B6B"/>
        <path d="M4 10 L12 18 L24 4" fill="#FFE55C" opacity="0.4"/>
      </symbol>

      <!-- Accessory: Detective Hat (Premium, L10) -->
      <symbol id="acc-detective-hat" viewBox="0 0 56 28">
        <ellipse cx="28" cy="24" rx="28" ry="6" fill="#8B6914"/>
        <path d="M10 24 C10 10, 20 2, 28 2 C36 2, 46 10, 46 24" fill="#A0782C"/>
        <path d="M10 24 C10 10, 20 2, 28 2 C36 2, 46 10, 46 24" fill="#B8912E" opacity="0.3"/>
        <rect x="18" y="16" width="20" height="4" rx="2" fill="#8B6914"/>
      </symbol>

      <!-- Accessory: Top Hat (Premium, L15) -->
      <symbol id="acc-top-hat" viewBox="0 0 44 36">
        <ellipse cx="22" cy="32" rx="22" ry="5" fill="#1A1A2E"/>
        <rect x="8" y="4" width="28" height="28" rx="2" fill="#2D2B55"/>
        <rect x="8" y="4" width="28" height="28" rx="2" fill="#3D3B75" opacity="0.3"/>
        <rect x="10" y="22" width="24" height="4" rx="1" fill="#E74C3C"/>
        <ellipse cx="22" cy="4" rx="14" ry="3" fill="#2D2B55"/>
      </symbol>

      <!-- Accessory: Halo (Premium, L20) -->
      <symbol id="acc-halo" viewBox="0 0 44 14">
        <ellipse cx="22" cy="7" rx="20" ry="6" fill="none" stroke="#FFD700" stroke-width="3"/>
        <ellipse cx="22" cy="7" rx="20" ry="6" fill="none" stroke="#FFF8DC" stroke-width="1" opacity="0.5"/>
        <ellipse cx="14" cy="4" rx="3" ry="1.5" fill="#FFFFFF" opacity="0.4"/>
      </symbol>

      <!-- Accessory: Flame Crown (Pro) -->
      <symbol id="acc-flame-crown" viewBox="0 0 48 32">
        <path d="M4 28 L8 12 L14 20 L20 4 L24 16 L28 2 L32 16 L38 4 L42 20 L44 12 L44 28 Z" fill="#FF6B35"/>
        <path d="M8 28 L12 16 L18 22 L24 10 L30 22 L36 16 L40 28 Z" fill="#FFD700" opacity="0.7"/>
        <path d="M14 28 L20 18 L24 14 L28 18 L34 28 Z" fill="#FFFFFF" opacity="0.2"/>
        <rect x="2" y="26" width="44" height="6" rx="3" fill="#FF4500"/>
      </symbol>

      <!-- Accessory: Neon Shades (Pro) -->
      <symbol id="acc-neon-shades" viewBox="0 0 56 20">
        <rect x="2" y="4" width="22" height="14" rx="4" fill="#1A1A2E"/>
        <rect x="32" y="4" width="22" height="14" rx="4" fill="#1A1A2E"/>
        <rect x="24" y="8" width="8" height="3" rx="1.5" fill="#1A1A2E"/>
        <rect x="3" y="5" width="20" height="12" rx="3" fill="none" stroke="#00FF88" stroke-width="1.5"/>
        <rect x="33" y="5" width="20" height="12" rx="3" fill="none" stroke="#FF00FF" stroke-width="1.5"/>
        <line x1="0" y1="10" x2="2" y2="10" stroke="#1A1A2E" stroke-width="2" stroke-linecap="round"/>
        <line x1="54" y1="10" x2="56" y2="10" stroke="#1A1A2E" stroke-width="2" stroke-linecap="round"/>
      </symbol>

      <!-- Accessory: Wizard Hat (Pro) -->
      <symbol id="acc-wizard-hat" viewBox="0 0 48 40">
        <path d="M24 0 C26 4, 38 14, 44 36 L4 36 C10 14, 22 4, 24 0 Z" fill="#4A1A8A"/>
        <path d="M24 0 C26 4, 38 14, 44 36 L24 36 Z" fill="#5C2DA0" opacity="0.4"/>
        <ellipse cx="24" cy="36" rx="24" ry="5" fill="#3D1275"/>
        <circle cx="24" cy="2" r="3" fill="#FFD700"/>
        <circle cx="18" cy="18" r="2" fill="#FFD700" opacity="0.6"/>
        <circle cx="30" cy="24" r="1.5" fill="#FFD700" opacity="0.4"/>
        <circle cx="14" cy="28" r="1" fill="#FFD700" opacity="0.3"/>
        <rect x="2" y="32" width="44" height="4" rx="2" fill="#FFD700"/>
      </symbol>

      <!-- Accessory: Bandana (Premium, L4) -->
      <symbol id="acc-bandana" viewBox="0 0 52 22">
        <path d="M4 14 C4 6, 16 2, 26 2 C36 2, 48 6, 48 14" fill="#E74C3C"/>
        <path d="M4 14 C4 6, 16 2, 26 2 C36 2, 48 6, 48 14" fill="#FF6B6B" opacity="0.3"/>
        <rect x="0" y="12" width="52" height="6" rx="3" fill="#C0392B"/>
        <circle cx="14" cy="8" r="2" fill="#FFFFFF" opacity="0.3"/>
        <circle cx="26" cy="6" r="2" fill="#FFFFFF" opacity="0.3"/>
        <circle cx="38" cy="8" r="2" fill="#FFFFFF" opacity="0.3"/>
        <path d="M44 14 C48 16, 52 20, 50 22 C48 22, 44 18, 44 14 Z" fill="#C0392B"/>
      </symbol>

      <!-- Accessory: Heart Shades (Premium, L5) -->
      <symbol id="acc-heart-shades" viewBox="0 0 56 20">
        <path d="M3 6 C3 2, 9 0, 14 3 C19 6, 19 12, 14 16 C10 18, 4 14, 3 6 Z" fill="#FF4081"/>
        <path d="M5 6 C5 3, 10 2, 13 4" stroke="#FF80AB" stroke-width="1.5" fill="none" stroke-linecap="round" opacity="0.4"/>
        <path d="M33 6 C33 2, 39 0, 44 3 C49 6, 49 12, 44 16 C40 18, 34 14, 33 6 Z" fill="#FF4081"/>
        <path d="M35 6 C35 3, 40 2, 43 4" stroke="#FF80AB" stroke-width="1.5" fill="none" stroke-linecap="round" opacity="0.4"/>
        <rect x="24" y="8" width="8" height="3" rx="1.5" fill="#FF4081"/>
        <line x1="0" y1="10" x2="3" y2="9" stroke="#FF4081" stroke-width="2" stroke-linecap="round"/>
        <line x1="53" y1="10" x2="56" y2="9" stroke="#FF4081" stroke-width="2" stroke-linecap="round"/>
      </symbol>

      <!-- Accessory: Aviators (Premium, L7) -->
      <symbol id="acc-aviators" viewBox="0 0 56 22">
        <path d="M4 6 C4 2, 10 0, 16 2 C20 3, 22 6, 22 10 C22 16, 16 20, 10 18 C4 16, 2 12, 4 6 Z" fill="#D4AF37" opacity="0.25"/>
        <path d="M4 6 C4 2, 10 0, 16 2 C20 3, 22 6, 22 10 C22 16, 16 20, 10 18 C4 16, 2 12, 4 6 Z" fill="none" stroke="#C9A84C" stroke-width="1.5"/>
        <path d="M34 6 C34 2, 40 0, 46 2 C50 3, 52 6, 52 10 C52 16, 46 20, 40 18 C34 16, 32 12, 34 6 Z" fill="#D4AF37" opacity="0.25"/>
        <path d="M34 6 C34 2, 40 0, 46 2 C50 3, 52 6, 52 10 C52 16, 46 20, 40 18 C34 16, 32 12, 34 6 Z" fill="none" stroke="#C9A84C" stroke-width="1.5"/>
        <path d="M22 10 C25 8, 31 8, 34 10" stroke="#C9A84C" stroke-width="1.5" fill="none"/>
        <line x1="0" y1="8" x2="4" y2="7" stroke="#C9A84C" stroke-width="2" stroke-linecap="round"/>
        <line x1="52" y1="8" x2="56" y2="7" stroke="#C9A84C" stroke-width="2" stroke-linecap="round"/>
      </symbol>

      <!-- Accessory: Chef Hat (Premium, L8) -->
      <symbol id="acc-chef-hat" viewBox="0 0 48 34">
        <ellipse cx="24" cy="10" rx="18" ry="10" fill="#FFFFFF"/>
        <ellipse cx="12" cy="14" rx="8" ry="8" fill="#FFFFFF"/>
        <ellipse cx="36" cy="14" rx="8" ry="8" fill="#FFFFFF"/>
        <ellipse cx="24" cy="8" rx="10" ry="8" fill="#FFFFFF"/>
        <rect x="8" y="18" width="32" height="12" fill="#FFFFFF"/>
        <rect x="6" y="28" width="36" height="6" rx="3" fill="#F0F0F0"/>
        <line x1="12" y1="30" x2="12" y2="33" stroke="#E0E0E0" stroke-width="1"/>
        <line x1="20" y1="30" x2="20" y2="33" stroke="#E0E0E0" stroke-width="1"/>
        <line x1="28" y1="30" x2="28" y2="33" stroke="#E0E0E0" stroke-width="1"/>
        <line x1="36" y1="30" x2="36" y2="33" stroke="#E0E0E0" stroke-width="1"/>
      </symbol>

      <!-- Accessory: 3D Glasses (Premium, L9) -->
      <symbol id="acc-3d-glasses" viewBox="0 0 56 20">
        <rect x="2" y="4" width="22" height="14" rx="2" fill="#E74C3C" opacity="0.7"/>
        <rect x="2" y="4" width="22" height="14" rx="2" fill="none" stroke="#2D2A26" stroke-width="1.5"/>
        <rect x="32" y="4" width="22" height="14" rx="2" fill="#3498DB" opacity="0.7"/>
        <rect x="32" y="4" width="22" height="14" rx="2" fill="none" stroke="#2D2A26" stroke-width="1.5"/>
        <rect x="24" y="8" width="8" height="3" rx="1.5" fill="#2D2A26"/>
        <line x1="0" y1="10" x2="2" y2="10" stroke="#2D2A26" stroke-width="2" stroke-linecap="round"/>
        <line x1="54" y1="10" x2="56" y2="10" stroke="#2D2A26" stroke-width="2" stroke-linecap="round"/>
      </symbol>

      <!-- Accessory: Propeller Hat (Premium, L11) -->
      <symbol id="acc-propeller-hat" viewBox="0 0 48 32">
        <path d="M8 28 C8 16, 16 8, 24 8 C32 8, 40 16, 40 28" fill="#F39C12"/>
        <path d="M8 28 C8 16, 16 8, 24 8 C32 8, 40 16, 40 28" fill="#F1C40F" opacity="0.3"/>
        <rect x="4" y="26" width="40" height="6" rx="3" fill="#E67E22"/>
        <line x1="10" y1="28" x2="10" y2="31" stroke="#F39C12" stroke-width="2"/>
        <line x1="24" y1="28" x2="24" y2="31" stroke="#F39C12" stroke-width="2"/>
        <line x1="38" y1="28" x2="38" y2="31" stroke="#F39C12" stroke-width="2"/>
        <circle cx="24" cy="6" r="3" fill="#95A5A6"/>
        <path d="M24 6 L14 2 C12 1, 12 3, 14 4 Z" fill="#E74C3C"/>
        <path d="M24 6 L34 2 C36 1, 36 3, 34 4 Z" fill="#3498DB"/>
        <path d="M24 6 L24 0 C23 -1, 25 -1, 24 0 Z" fill="#2ECC71"/>
      </symbol>

      <!-- Accessory: Star Glasses (Premium, L12) -->
      <symbol id="acc-star-glasses" viewBox="0 0 56 22">
        <polygon points="13,1 15.5,7 23,7 17,11.5 19,19 13,14 7,19 9,11.5 3,7 10.5,7" fill="#FFD700"/>
        <polygon points="43,1 45.5,7 53,7 47,11.5 49,19 43,14 37,19 39,11.5 33,7 40.5,7" fill="#FFD700"/>
        <polygon points="13,3 14.5,7.5 19,7.5 15.5,10.5 16.5,15 13,12 9.5,15 10.5,10.5 7,7.5 11.5,7.5" fill="#FFF8DC" opacity="0.3"/>
        <rect x="23" y="8" width="10" height="3" rx="1.5" fill="#DAA520"/>
        <line x1="0" y1="10" x2="3" y2="9" stroke="#DAA520" stroke-width="2" stroke-linecap="round"/>
        <line x1="53" y1="10" x2="56" y2="9" stroke="#DAA520" stroke-width="2" stroke-linecap="round"/>
      </symbol>

      <!-- Accessory: Bow Tie (Premium, L14) — glasses slot (chin area) -->
      <symbol id="acc-bow-tie" viewBox="0 0 44 20">
        <path d="M22 10 L6 2 C2 0, 0 4, 2 8 L6 10 L2 12 C0 16, 2 20, 6 18 Z" fill="#E74C3C"/>
        <path d="M22 10 L38 2 C42 0, 44 4, 42 8 L38 10 L42 12 C44 16, 42 20, 38 18 Z" fill="#E74C3C"/>
        <path d="M22 10 L6 2 C2 0, 0 4, 2 8 L6 10" fill="#FF6B6B" opacity="0.3"/>
        <circle cx="22" cy="10" r="3" fill="#C0392B"/>
        <circle cx="22" cy="10" r="1.5" fill="#E74C3C"/>
      </symbol>

      <!-- Accessory: Headband (Premium, L16) -->
      <symbol id="acc-headband" viewBox="0 0 52 18">
        <rect x="0" y="8" width="52" height="8" rx="4" fill="#9B59B6"/>
        <rect x="0" y="8" width="52" height="4" rx="2" fill="#8E44AD" opacity="0.5"/>
        <path d="M20 8 C20 2, 24 0, 26 0 C28 0, 32 2, 32 8" fill="#9B59B6"/>
        <path d="M22 8 C22 4, 24 2, 26 2 C28 2, 30 4, 30 8" fill="#8E44AD" opacity="0.4"/>
        <circle cx="26" cy="1" r="1.5" fill="#F1C40F"/>
      </symbol>

      <!-- Accessory: Viking Helmet (Premium, L17) -->
      <symbol id="acc-viking-helmet" viewBox="0 0 56 32">
        <path d="M12 28 C12 14, 20 6, 28 6 C36 6, 44 14, 44 28" fill="#8B7355"/>
        <path d="M12 28 C12 14, 20 6, 28 6 C36 6, 44 14, 44 28" fill="#A0896C" opacity="0.3"/>
        <rect x="8" y="24" width="40" height="8" rx="4" fill="#6B5344"/>
        <circle cx="16" cy="28" r="2" fill="#C9A84C"/>
        <circle cx="28" cy="28" r="2" fill="#C9A84C"/>
        <circle cx="40" cy="28" r="2" fill="#C9A84C"/>
        <path d="M10 22 C6 18, 0 8, 2 2 C3 0, 6 2, 6 6 C6 12, 10 18, 12 22" fill="#F5F5DC" stroke="#D4C9A8" stroke-width="1"/>
        <path d="M46 22 C50 18, 56 8, 54 2 C53 0, 50 2, 50 6 C50 12, 46 18, 44 22" fill="#F5F5DC" stroke="#D4C9A8" stroke-width="1"/>
      </symbol>

      <!-- Accessory: Pirate Hat (Premium, L19) -->
      <symbol id="acc-pirate-hat" viewBox="0 0 56 30">
        <ellipse cx="28" cy="26" rx="28" ry="6" fill="#1A1A2E"/>
        <path d="M6 26 C6 14, 16 4, 28 4 C40 4, 50 14, 50 26" fill="#2D2B55"/>
        <path d="M6 26 C6 14, 16 4, 28 4 C40 4, 50 14, 50 26" fill="#3D3B75" opacity="0.2"/>
        <path d="M2 26 C0 24, 4 20, 8 22" fill="#1A1A2E"/>
        <path d="M54 26 C56 24, 52 20, 48 22" fill="#1A1A2E"/>
        <circle cx="28" cy="14" r="6" fill="none" stroke="#FFFFFF" stroke-width="1.5"/>
        <path d="M24 11 L28 8 L32 11 L32 17 L28 20 L24 17 Z" fill="none" stroke="#FFFFFF" stroke-width="1" opacity="0.6"/>
      </symbol>
  `;

  function init() {
    // Avoid double-injection
    if (document.getElementById('jesty-shared-symbols')) return;

    const svgContainer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgContainer.setAttribute('id', 'jesty-shared-symbols');
    svgContainer.setAttribute('style', 'display: none');

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = SVG_SYMBOLS;
    svgContainer.appendChild(defs);

    document.body.insertBefore(svgContainer, document.body.firstChild);
  }

  return { init };
})();

window.JestyCharacters = JestyCharacters;
