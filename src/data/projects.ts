// Add a project = add one entry here. Cards are rendered in this order.
export interface Project {
  name: string;
  url: string; // live site
  repo?: string; // source code
  summary: string;
  highlights?: string[];
  stack: string[];
  image?: string; // path under public/, e.g. "/img/lifecouture.png"
  status?: "live" | "in-progress" | "archived";
}

export const projects: Project[] = [
  {
    name: "Life Couture",
    url: "https://lifecouture.duchongle.com",
    repo: "https://github.com/Sonny-77-98/lifecouture",
    summary:
      "An e-commerce storefront with an admin dashboard for products, variants, inventory and orders.",
    highlights: [
      "Relational MySQL schema with stored procedures and triggers",
      "JWT-authenticated admin panel",
      "Multi-language UI with i18next",
    ],
    stack: ["React", "Express", "MySQL", "i18next", "JWT"],
    // image: "/img/lifecouture.png",
    status: "live",
  },
];
