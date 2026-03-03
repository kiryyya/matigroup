"use client";

import * as React from "react";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import { Checkbox } from "~/components/ui/checkbox";
import { Filter, X } from "lucide-react";
import { cn } from "~/lib/utils";
import type { CategoryFilterDefinition } from "~/types/category-filters";

export interface FilterOptions {
  searchQuery: string;
  sortBy: 'date' | 'alphabet';
  sortOrder: 'asc' | 'desc';
  dateRange: 'all' | 'week' | 'month' | 'year';
  categoryValues: Record<string, string>;
}

interface FilterModalProps {
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
  onClearFilters: () => void;
  projectCount: number;
  categoryFilters?: CategoryFilterDefinition[];
}

export default function FilterModal({ 
  filters, 
  onFiltersChange, 
  onClearFilters, 
  projectCount,
  categoryFilters = [],
}: FilterModalProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [localFilters, setLocalFilters] = React.useState<FilterOptions>(filters);

  React.useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const hasActiveFilters = 
    filters.searchQuery !== '' || 
    filters.sortBy !== 'date' || 
    filters.sortOrder !== 'desc' || 
    filters.dateRange !== 'all' ||
    Object.values(filters.categoryValues).some(Boolean);

  const handleApplyFilters = () => {
    onFiltersChange(localFilters);
    setIsOpen(false);
  };

  const handleClearFilters = () => {
    const defaultFilters: FilterOptions = {
      searchQuery: '',
      sortBy: 'date',
      sortOrder: 'desc',
      dateRange: 'all',
      categoryValues: {},
    };
    setLocalFilters(defaultFilters);
    onClearFilters();
    setIsOpen(false);
  };

  const updateFilter = <K extends keyof FilterOptions>(
    key: K,
    value: FilterOptions[K],
  ) => {
    setLocalFilters(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="icon"
          className={cn(
            "relative",
            hasActiveFilters && "bg-gray-50 border-gray-200 text-gray-700"
          )}
        >
          <Filter className="h-4 w-4" />
          {hasActiveFilters && (
            <span className="absolute -top-1 -right-1 px-1.5 py-0.5 text-xs bg-gray-100 text-gray-700 rounded-full min-w-[20px] h-5 flex items-center justify-center">
              {projectCount}
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md rounded-lg mx-4">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            Фильтры и сортировка
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="text-gray-600 hover:text-gray-700"
              >
                <X className="h-4 w-4 mr-1" />
                Очистить
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">

          {/* Сортировка */}
          <div className="space-y-3">
            <Label>Сортировка</Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="sort-date"
                  checked={localFilters.sortBy === 'date'}
                  onCheckedChange={(checked) => 
                    checked && updateFilter('sortBy', 'date')
                  }
                />
                <Label htmlFor="sort-date" className="text-sm font-normal">
                  По дате добавления
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="sort-alphabet"
                  checked={localFilters.sortBy === 'alphabet'}
                  onCheckedChange={(checked) => 
                    checked && updateFilter('sortBy', 'alphabet')
                  }
                />
                <Label htmlFor="sort-alphabet" className="text-sm font-normal">
                  По алфавиту
                </Label>
              </div>
            </div>
          </div>

          {/* Порядок сортировки */}
          <div className="space-y-3">
            <Label>Порядок</Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="order-desc"
                  checked={localFilters.sortOrder === 'desc'}
                  onCheckedChange={(checked) => 
                    checked && updateFilter('sortOrder', 'desc')
                  }
                />
                <Label htmlFor="order-desc" className="text-sm font-normal">
                  {localFilters.sortBy === 'date' ? 'Новые сначала' : 'Я → А'}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="order-asc"
                  checked={localFilters.sortOrder === 'asc'}
                  onCheckedChange={(checked) => 
                    checked && updateFilter('sortOrder', 'asc')
                  }
                />
                <Label htmlFor="order-asc" className="text-sm font-normal">
                  {localFilters.sortBy === 'date' ? 'Старые сначала' : 'А → Я'}
                </Label>
              </div>
            </div>
          </div>

          {/* Фильтр по дате */}
          <div className="space-y-3">
            <Label>Период</Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="date-all"
                  checked={localFilters.dateRange === 'all'}
                  onCheckedChange={(checked) => 
                    checked && updateFilter('dateRange', 'all')
                  }
                />
                <Label htmlFor="date-all" className="text-sm font-normal">
                  За все время
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="date-week"
                  checked={localFilters.dateRange === 'week'}
                  onCheckedChange={(checked) => 
                    checked && updateFilter('dateRange', 'week')
                  }
                />
                <Label htmlFor="date-week" className="text-sm font-normal">
                  За неделю
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="date-month"
                  checked={localFilters.dateRange === 'month'}
                  onCheckedChange={(checked) => 
                    checked && updateFilter('dateRange', 'month')
                  }
                />
                <Label htmlFor="date-month" className="text-sm font-normal">
                  За месяц
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="date-year"
                  checked={localFilters.dateRange === 'year'}
                  onCheckedChange={(checked) => 
                    checked && updateFilter('dateRange', 'year')
                  }
                />
                <Label htmlFor="date-year" className="text-sm font-normal">
                  За год
                </Label>
              </div>
            </div>
          </div>

          {categoryFilters.length > 0 && (
            <div className="space-y-3">
              <Label>Фильтры категории</Label>
              <div className="space-y-2">
                {categoryFilters.map((filter) => (
                  <div key={filter.id} className="space-y-1">
                    <Label htmlFor={`category-filter-modal-${filter.id}`} className="text-sm font-normal">
                      {filter.name}
                    </Label>
                    <select
                      id={`category-filter-modal-${filter.id}`}
                      className="w-full p-2 border border-input rounded-md bg-background text-sm"
                      value={localFilters.categoryValues[filter.id] ?? ""}
                      onChange={(e) =>
                        updateFilter("categoryValues", {
                          ...localFilters.categoryValues,
                          [filter.id]: e.target.value,
                        })
                      }
                    >
                      <option value="">Все значения</option>
                      {filter.options.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-4">
          <Button onClick={handleApplyFilters} className="flex-1">
            Применить
          </Button>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Отмена
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
