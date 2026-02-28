type SkipLink = {
  href: string;
  label: string;
};

type SkipLinksProps = {
  links: SkipLink[];
};

const SkipLinks = ({ links }: SkipLinksProps) => {
  if (!Array.isArray(links) || links.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Atalhos de acessibilidade" className="a11y-skip-links">
      {links.map((link) => (
        <a key={`${link.href}-${link.label}`} href={link.href} className="a11y-skip-link">
          {link.label}
        </a>
      ))}
    </nav>
  );
};

export default SkipLinks;
