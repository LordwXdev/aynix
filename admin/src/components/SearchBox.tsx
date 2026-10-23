import { FormEvent, useEffect, useState } from "react";

// search field that applies on Enter (and when cleared)
export const SearchBox = ({
  value,
  placeholder,
  onSearch,
}: {
  value: string;
  placeholder: string;
  onSearch: (q: string) => void;
}) => {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSearch(text.trim());
  };

  return (
    <form onSubmit={submit} className="btn-row">
      <input
        type="search"
        value={text}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => {
          setText(e.target.value);
          if (e.target.value === "") onSearch("");
        }}
      />
      <button className="btn">Search</button>
    </form>
  );
};
