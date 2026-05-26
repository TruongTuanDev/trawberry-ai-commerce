from html import escape


def build_try_on_svg(
    *,
    title: str,
    subtitle: str,
    badge: str,
    accent: str,
    footer: str,
) -> bytes:
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1536" viewBox="0 0 1024 1536">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#fdf8ef" />
      <stop offset="100%" stop-color="{escape(accent)}" />
    </linearGradient>
  </defs>
  <rect width="1024" height="1536" fill="url(#bg)" />
  <rect x="72" y="72" width="880" height="1392" rx="48" fill="#ffffff" opacity="0.94" />
  <rect x="124" y="128" width="776" height="780" rx="36" fill="#f4efe8" />
  <ellipse cx="512" cy="356" rx="178" ry="190" fill="#e8ddd2" />
  <rect x="356" y="520" width="312" height="380" rx="148" fill="#ddd0c6" />
  <path d="M320 662 C378 574 446 530 512 530 C578 530 646 574 704 662 L748 980 L276 980 Z" fill="{escape(accent)}" opacity="0.85" />
  <rect x="164" y="986" width="696" height="320" rx="28" fill="#f7f5f1" />
  <text x="196" y="1080" font-family="Arial, sans-serif" font-size="54" font-weight="700" fill="#18212b">{escape(title)}</text>
  <text x="196" y="1148" font-family="Arial, sans-serif" font-size="32" fill="#4a5565">{escape(subtitle)}</text>
  <rect x="196" y="1190" width="252" height="56" rx="28" fill="#18212b" />
  <text x="224" y="1228" font-family="Arial, sans-serif" font-size="28" font-weight="700" fill="#ffffff">{escape(badge)}</text>
  <text x="196" y="1318" font-family="Arial, sans-serif" font-size="26" fill="#4a5565">{escape(footer)}</text>
</svg>"""
    return svg.encode("utf-8")
