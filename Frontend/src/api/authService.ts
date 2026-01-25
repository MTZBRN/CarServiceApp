import bcrypt from "bcryptjs";

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string; // Már nem 'password', hanem 'passwordHash'!
  role: "admin" | "mechanic";
}

const USERS_KEY = "app_users";

export const authService = {
  // Inicializálás: Ha nincs felhasználó, létrehozza az alap admint (HASH-elve)
  init: () => {
    const users = localStorage.getItem(USERS_KEY);
    if (!users) {
      // Az 'admin' jelszót is titkosítva mentjük el
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync("admin", salt);

      const defaultAdmin: User = {
        id: "1",
        name: "Fő Adminisztrátor",
        email: "admin",
        passwordHash: hash, // Titkosított jelszó
        role: "admin",
      };
      localStorage.setItem(USERS_KEY, JSON.stringify([defaultAdmin]));
    }
  },

  getUsers: (): User[] => {
    const users = localStorage.getItem(USERS_KEY);
    return users ? JSON.parse(users) : [];
  },

  // Bejelentkezés ellenőrzése (Összehasonlítás)
  login: (email: string, plainPassword: string): User | null => {
    const users = authService.getUsers();
    // 1. Megkeressük a felhasználót email alapján
    const user = users.find((u) => u.email === email);

    if (!user) return null;

    // 2. Összehasonlítjuk a beírt jelszót a tárolt HASH-el
    const isPasswordValid = bcrypt.compareSync(
      plainPassword,
      user.passwordHash,
    );

    if (isPasswordValid) {
      return user;
    }
    return null;
  },

  // Új felhasználó hozzáadása (Titkosítással)
  addUser: (user: Omit<User, "id" | "passwordHash"> & { password: string }) => {
    const users = authService.getUsers();

    if (users.some((u) => u.email === user.email)) {
      throw new Error("Ez az email cím / felhasználónév már foglalt!");
    }

    // ITT TÖRTÉNIK A VARÁZSLAT: Titkosítjuk a jelszót mentés előtt
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(user.password, salt);

    const newUser: User = {
      id: Date.now().toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      passwordHash: hashedPassword, // A titkosított verziót mentjük
    };

    users.push(newUser);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  },

  deleteUser: (id: string) => {
    const users = authService.getUsers();
    if (users.length === 1) {
      throw new Error("Az utolsó felhasználót nem törölheted!");
    }
    const filtered = users.filter((u) => u.id !== id);
    localStorage.setItem(USERS_KEY, JSON.stringify(filtered));
  },
};

authService.init();
