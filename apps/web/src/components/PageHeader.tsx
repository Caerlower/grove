export function PageHeader({
  title,
  children,
}: {
  path?: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="desk-head">
      <h1>{title}</h1>
      {children ? <p>{children}</p> : null}
    </header>
  );
}
