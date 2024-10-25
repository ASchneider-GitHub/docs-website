import visit from 'unist-util-visit';

import { getNodeText, isEmptyParagraph } from '../../codemods/utils/mdxast.js';
import { ERROR_TYPES } from './error-types.mjs';

export const validateSteps = (mdxAST) => {
  const errors = [];

  visit(
    mdxAST,
    (node) => node.name === 'Steps',
    (node) => {
      const nonStepChildren = node?.children?.filter(
        (child) => child.name !== 'Step'
      );
      nonStepChildren.forEach((child) => {
        const nodeInfo = child.position.start;
        errors.push({
          ...nodeInfo,
          reason: `<Steps> component must only contain <Step> components as immediate children but found ${nodeDescriptor(
            child
          )}`,
          type: ERROR_TYPES.VALIDATION_ERROR,
        });
      });
    }
  );

  return errors;
};

export const validateTabs = (mdxAST) => {
  const errors = [];
  visit(
    mdxAST,
    (node) => node.name === 'Tabs',
    (node) => {
      const tabs = node;
      const nonTabChildren = tabs?.children?.filter(
        (child) =>
          child.name !== 'TabsBar' &&
          child.name !== 'TabsPages' &&
          !isEmptyParagraph(child)
      );
      nonTabChildren.forEach((child) => {
        const nodeInfo = child.position.start;
        errors.push({
          ...nodeInfo,
          reason: `<Tabs> component must only contain <TabsBar> and <TabsPages> components as immediate children but found ${nodeDescriptor(
            child
          )}`,
          type: ERROR_TYPES.VALIDATION_ERROR,
        });
      });

      let tabsBar = node.children.filter((child) => child.name === 'TabsBar');
      let tabsPages = node.children.filter(
        (child) => child.name === 'TabsPages'
      );

      if (tabsBar.length > 1) {
        const nodeInfo = tabsBar.position.start;
        errors.push({
          ...nodeInfo,
          reason: '<Tabs> can only have one <TabsBar> child',
          type: ERROR_TYPES.VALIDATION_ERROR,
        });
      }
      if (tabsPages.length > 1) {
        const nodeInfo = tabsPages.position.start;
        errors.push({
          ...nodeInfo,
          message: '<Tabs> can only have one <TabsPages> child',
          type: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      tabsBar = tabsBar[0];
      tabsPages = tabsPages[0];

      if (tabsBar == null) {
        const nodeInfo = tabs.position.start;
        errors.push({
          ...nodeInfo,
          reason:
            'No <TabsBar> found! <Tabs> component must contain <TabsBar> as an immediate child',
          type: ERROR_TYPES.VALIDATION_ERROR,
        });
      }
      if (tabsPages == null) {
        const nodeInfo = tabs.position.start;
        errors.push({
          ...nodeInfo,
          reason:
            'No <TabsPages> found! <Tabs> component must contain <TabsPages> as an immediate child',
          type: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      if (tabsBar == null || tabsPages == null) {
        return errors;
      }

      const barItems = tabsBar.children.filter(
        (node) => node.name === 'TabsBarItem'
      );
      const pageItems = tabsPages.children.filter(
        (node) => node.name === 'TabsPageItem'
      );

      const barItemIdAttrs = barItems
        .flatMap((barItem) => barItem.attributes)
        .filter((attribute) => attribute.name === 'id');

      const barItemIdMap = new Map(
        barItemIdAttrs.map((attribute) => [attribute.value, attribute])
      );

      const pageItemIdAttrs = pageItems
        .flatMap((pageItem) => pageItem.attributes)
        .filter((attribute) => attribute.name === 'id');
      const pageItemIdMap = new Map(
        pageItemIdAttrs.map((attribute) => [attribute.value, attribute])
      );

      const barItemUniqIds = new Set(barItemIdMap.keys());
      const pageItemUniqIds = new Set(pageItemIdMap.keys());

      const missingPageItemIds = barItemUniqIds.difference(pageItemUniqIds);
      const missingBarItemIds = pageItemUniqIds.difference(barItemUniqIds);

      missingPageItemIds.forEach((id) => {
        const nodeInfo = tabs.position?.start ?? {};
        errors.push({
          ...nodeInfo,
          reason: `Found a <TabsBarItem> with id "${id}" but no corresponding <TabsPageItem>. Tabs components must come in pairs.`,
          type: ERROR_TYPES.VALIDATION_ERROR,
        });
      });
      missingBarItemIds.forEach((id) => {
        const nodeInfo = tabs.position?.start ?? {};
        errors.push({
          ...nodeInfo,
          reason: `Found a <TabsPageItem> with id "${id}" but no corresponding <TabsBarItem>. Tabs components must come in pairs.`,
          type: ERROR_TYPES.VALIDATION_ERROR,
        });
      });

      const dupeBarItemIds = getDuplicateIdAttributes(barItemIdAttrs);
      const dupePageItemIds = getDuplicateIdAttributes(pageItemIdAttrs);

      dupeBarItemIds.forEach((id) => {
        const nodeInfo = tabs.position?.start ?? {};
        errors.push({
          ...nodeInfo,
          reason: `Found a <TabsBarItem> with a duplicate id "${id}". <TabsBarItem>s must have unique ids.`,
          type: ERROR_TYPES.VALIDATION_ERROR,
        });
      });
      dupePageItemIds.forEach((id) => {
        const nodeInfo = tabs.position?.start ?? {};
        errors.push({
          ...nodeInfo,
          reason: `Found a <TabsPageItem> with a duplicate id "${id}". <TabsPageItem>s must have unique ids.`,
          type: ERROR_TYPES.VALIDATION_ERROR,
        });
      });
    }
  );

  return errors;
};

const getDuplicateIdAttributes = (attributes) => {
  const counts = new Map();
  attributes.forEach((attribute) => {
    const id = attribute.value;
    const currentCount = counts.get(id);
    counts.set(id, (currentCount ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .filter(([_id, count]) => count > 1)
    .map(([id]) => id);
};

const nodeDescriptor = (node) => {
  const isMdxElement = node.type === 'mdxBlockElement';
  if (isMdxElement) {
    return `<${node.name}>`;
  }

  if (node.type === 'paragraph') {
    const text = getNodeText(node).replace('\n', '');
    let truncated = text.slice(0, 30);
    if (truncated.length !== text.length) truncated += '...';
    return `"${truncated}"`;
  }

  return node.type;
};

export const validators = [validateSteps, validateTabs];
