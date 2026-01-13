import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Template } from '../types/database';
import { templateCategories, type TemplateCategory } from '../lib/constants';

export type TemplatesByCategory = Record<TemplateCategory, Template[]>;

export function useTemplates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templatesByCategory, setTemplatesByCategory] = useState<TemplatesByCategory>(
    {} as TemplatesByCategory
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('templates')
          .select('*')
          .eq('is_active', true)
          .order('usage_count', { ascending: false });

        if (fetchError) throw fetchError;

        const templatesData = (data || []) as Template[];
        setTemplates(templatesData);

        // Group by category
        const grouped = templatesData.reduce((acc, template) => {
          const category = template.category as TemplateCategory;
          if (!acc[category]) {
            acc[category] = [];
          }
          acc[category].push(template);
          return acc;
        }, {} as TemplatesByCategory);

        setTemplatesByCategory(grouped);
      } catch (err: any) {
        console.error('Error fetching templates:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTemplates();
  }, []);

  const getTemplatesByCategory = (category: TemplateCategory) => {
    return templatesByCategory[category] || [];
  };

  return {
    templates,
    templatesByCategory,
    getTemplatesByCategory,
    categories: templateCategories,
    isLoading,
    error,
  };
}
