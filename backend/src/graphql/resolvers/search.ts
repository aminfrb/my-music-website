import { searchService } from "../../services/search.service";

export const searchResolvers = {
  Query: {
    search(_p: unknown, { query, perCategory }: { query: string; perCategory?: number }) {
      const n = perCategory && perCategory > 0 ? Math.min(perCategory, 25) : 10;
      return searchService.search(query, n);
    },
  },
};
