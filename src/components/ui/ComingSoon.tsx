interface Props {
  title: string;
  description?: string;
  icon?: string;
}

export default function ComingSoon({ title, description, icon = '🚧' }: Props) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="text-5xl mb-4">{icon}</div>
        <h1 className="text-2xl font-serif font-semibold text-primary-800 mb-3">{title}</h1>
        <p className="text-neutral-500 text-sm leading-relaxed">
          {description ?? 'This section is being built. Check back soon.'}
        </p>
      </div>
    </div>
  );
}
