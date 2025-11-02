import React from 'react';

export default function LoginButton() {
  const handleLogin = () => {
    window.location.href = '/auth/login';
  };

  const handleLogout = async () => {
    await fetch('/auth/logout', { method: 'POST' });
    window.location.reload();
  };

  return (
    <div>
      <button onClick={handleLogout} className="btn">Logout</button>
    </div>
  );
}
