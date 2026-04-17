import { buildTranslationMap, translateTag } from "@/lib/project-taxonomy";
import {
  type PostSearchItem,
  type ProjectSearchItem,
  selectVisibleTags,
  sortAlphabeticallyPtBr,
} from "@/lib/search-ranking";
import type { PublicBootstrapPost, PublicBootstrapProject } from "@/types/public-bootstrap";

export type PublicSearchIndex = {
  postItems: PostSearchItem[];
  projectItems: ProjectSearchItem[];
};

export const buildPublicSearchIndex = ({
  posts,
  projects,
  tagTranslations,
}: {
  posts: PublicBootstrapPost[];
  projects: PublicBootstrapProject[];
  tagTranslations: Record<string, string>;
}): PublicSearchIndex => {
  const tagTranslationMap = buildTranslationMap(tagTranslations);

  return {
    projectItems: projects.map((project) => ({
      label: project.title,
      href: `/projeto/${project.id}`,
      image: project.cover,
      synopsis: project.synopsis,
      tags: selectVisibleTags(
        sortAlphabeticallyPtBr(project.tags.map((tag) => translateTag(tag, tagTranslationMap))),
        2,
        18,
      ),
    })),
    postItems: posts.map((post) => ({
      label: post.title,
      href: `/postagem/${post.slug}`,
      excerpt: post.excerpt || "",
    })),
  };
};
