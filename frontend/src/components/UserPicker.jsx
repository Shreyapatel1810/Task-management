export default function UserPicker({ users, selected, onChange, meId }) {
  const toggle = (id) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  return (
    <div className="picker">
      {users.map((u) => (
        <label key={u.id} className="picker__item">
          <input type="checkbox" checked={selected.includes(u.id)} onChange={() => toggle(u.id)} />
          {u.id === meId ? `${u.name} (me)` : u.name}
        </label>
      ))}
    </div>
  );
}