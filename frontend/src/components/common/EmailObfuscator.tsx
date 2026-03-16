"use client";

import React from "react";

interface EmailObfuscatorProps {
  user: string;
  domain: string;
  className?: string;
}

/**
 * Component to protect email addresses from simple scrapers.
 * Reconstructs the email on the client side and uses a hidden span to confuse text parsers.
 */
export const EmailObfuscator: React.FC<EmailObfuscatorProps> = ({ 
  user, 
  domain, 
  className = "text-[#C8FF00] hover:underline transition-colors" 
}) => {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    // Reconstruct the email only when clicked
    window.location.href = `mailto:${user}@${domain}`;
  };

  return (
    <a
      href="#"
      onClick={handleClick}
      className={className}
      aria-label="Send email"
    >
      {user}
      <span className="hidden" aria-hidden="true">
        -anti-bot-
      </span>
      @
      {domain}
    </a>
  );
};
