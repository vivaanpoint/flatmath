export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
  }).format(amount);
};

export const formatDate = (dateInput: string | Date) => {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  
  return `${day}/${month}/${year}`;
};

export const getAvatarDetails = (name: string) => {
  if (!name) return { initials: '??', colorClass: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' };

  const cleanName = name.trim();
  let initials = '';

  if (cleanName.toLowerCase() === 'test user') {
    initials = 'T1';
  } else {
    const parts = cleanName.split(/\s+/);
    if (parts.length > 0) {
      const firstWord = parts[0];
      initials += firstWord[0] || '';
      
      if (parts.length > 1) {
        const lastWord = parts[parts.length - 1];
        initials += lastWord[0] || '';
      } else if (firstWord.length > 1) {
        initials += firstWord[1] || '';
      }
    }
  }
  
  initials = initials.slice(0, 2).toUpperCase();

  const colors = [
    { bg: 'bg-blue-100 dark:bg-blue-950/60', text: 'text-blue-600 dark:text-blue-400' },
    { bg: 'bg-emerald-100 dark:bg-emerald-950/60', text: 'text-emerald-600 dark:text-emerald-400' },
    { bg: 'bg-amber-100 dark:bg-amber-950/60', text: 'text-amber-600 dark:text-amber-400' },
    { bg: 'bg-rose-100 dark:bg-rose-950/60', text: 'text-rose-600 dark:text-rose-400' },
    { bg: 'bg-purple-100 dark:bg-purple-950/60', text: 'text-purple-600 dark:text-purple-400' },
    { bg: 'bg-cyan-100 dark:bg-cyan-950/60', text: 'text-cyan-600 dark:text-cyan-400' },
    { bg: 'bg-teal-100 dark:bg-teal-950/60', text: 'text-teal-600 dark:text-teal-400' },
    { bg: 'bg-indigo-100 dark:bg-indigo-950/60', text: 'text-indigo-600 dark:text-indigo-400' },
  ];

  let sum = 0;
  for (let i = 0; i < cleanName.length; i++) {
    sum += cleanName.charCodeAt(i);
  }
  const color = colors[sum % colors.length];

  return {
    initials,
    colorClass: `${color.bg} ${color.text}`,
  };
};

export const formatDateShort = (dateInput: string | Date) => {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()];
  const day = d.getDate();
  const year = d.getFullYear();
  
  return `${month} ${day}, ${year}`;
};

