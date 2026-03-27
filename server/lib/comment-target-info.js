export const buildCommentTargetInfo = (comment, posts, projects, primaryAppOrigin) => {
  if (comment.targetType === "post") {
    const post = posts.find((item) => item.slug === comment.targetId);
    if (!post) {
      return { label: "Postagem", url: primaryAppOrigin };
    }
    return {
      label: post.title,
      url: `${primaryAppOrigin}/postagem/${post.slug}#comment-${comment.id}`,
    };
  }

  if (comment.targetType === "project") {
    const project = projects.find((item) => item.id === comment.targetId);
    if (!project) {
      return { label: "Projeto", url: primaryAppOrigin };
    }
    return {
      label: project.title,
      url: `${primaryAppOrigin}/projeto/${project.id}#comment-${comment.id}`,
    };
  }

  if (comment.targetType === "chapter") {
    const project = projects.find((item) => item.id === comment.targetId);
    const chapterNumber = comment.targetMeta?.chapterNumber;
    const volume = comment.targetMeta?.volume;
    const chapterLabel = chapterNumber ? `Cap\u00edtulo ${chapterNumber}` : "Cap\u00edtulo";
    const projectLabel = project?.title ? `${project.title} \u2022 ${chapterLabel}` : chapterLabel;
    const volumeQuery = Number.isFinite(volume) ? `?volume=${volume}` : "";
    const url = project
      ? `${primaryAppOrigin}/projeto/${project.id}/leitura/${chapterNumber}${volumeQuery}#comment-${comment.id}`
      : primaryAppOrigin;
    return { label: projectLabel, url };
  }

  return { label: "Coment\u00e1rio", url: primaryAppOrigin };
};
