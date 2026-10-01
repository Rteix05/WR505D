import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import CatalogToolbar from '~/components/CatalogToolbar.vue'
import { DEFAULT_FILTERS } from '~/utils/catalogQuery'
import type { CatalogFilters } from '~/types/catalog'
import type { Category } from '~/types/dummyjson'

const categories: Category[] = [
  { slug: 'beauty', name: 'Beauty', url: 'https://dummyjson.com/products/category/beauty' },
  {
    slug: 'smartphones',
    name: 'Smartphones',
    url: 'https://dummyjson.com/products/category/smartphones',
  },
]

const filters = (changes: Partial<CatalogFilters> = {}): CatalogFilters => ({
  ...DEFAULT_FILTERS,
  ...changes,
})

describe('CatalogToolbar', () => {
  it('reprend les valeurs de l’URL dans les menus', async () => {
    const wrapper = await mountSuspended(CatalogToolbar, {
      props: {
        filters: filters({ category: 'beauty', sortBy: 'price', order: 'desc' }),
        categories,
      },
    })
    expect(wrapper.find<HTMLSelectElement>('#filter-category').element.value).toBe('beauty')
    expect(wrapper.find<HTMLSelectElement>('#filter-sort').element.value).toBe('price-desc')
  })

  it('chaque menu a un label relié', async () => {
    const wrapper = await mountSuspended(CatalogToolbar, {
      props: { filters: filters(), categories },
    })
    expect(wrapper.find('label[for="filter-category"]').exists()).toBe(true)
    expect(wrapper.find('label[for="filter-sort"]').exists()).toBe(true)
  })

  it('choisir une option ne déclenche rien, « Appliquer » émet les filtres', async () => {
    const wrapper = await mountSuspended(CatalogToolbar, {
      props: { filters: filters(), categories },
    })

    await wrapper.find('#filter-category').setValue('smartphones')
    await wrapper.find('#filter-sort').setValue('rating-desc')
    expect(wrapper.emitted('apply')).toBeUndefined()

    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('apply')).toEqual([
      [{ category: 'smartphones', sortBy: 'rating', order: 'desc' }],
    ])
  })

  it('« Toutes les catégories » et « Pertinence » émettent l’absence de filtre', async () => {
    const wrapper = await mountSuspended(CatalogToolbar, {
      props: { filters: filters({ category: 'beauty', sortBy: 'title' }), categories },
    })
    await wrapper.find('#filter-category').setValue('')
    await wrapper.find('#filter-sort').setValue('relevance')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('apply')?.[0]).toEqual([{ category: null, sortBy: null, order: 'asc' }])
  })

  it('l’URL change sans le formulaire (bouton retour) : les menus suivent', async () => {
    const wrapper = await mountSuspended(CatalogToolbar, {
      props: { filters: filters({ category: 'beauty' }), categories },
    })
    await wrapper.setProps({ filters: filters({ category: 'smartphones', sortBy: 'title' }) })
    expect(wrapper.find<HTMLSelectElement>('#filter-category').element.value).toBe('smartphones')
    expect(wrapper.find<HTMLSelectElement>('#filter-sort').element.value).toBe('title-asc')
  })

  it('« Effacer les filtres » seulement quand un filtre ou un tri est actif', async () => {
    const empty = await mountSuspended(CatalogToolbar, {
      props: { filters: filters(), categories },
    })
    expect(empty.text()).not.toContain('Effacer les filtres')

    const active = await mountSuspended(CatalogToolbar, {
      props: { filters: filters({ sortBy: 'price' }), categories },
    })
    expect(active.text()).toContain('Effacer les filtres')
  })

  it('sans JavaScript : formulaire GET vers /produits, recherche et prix conservés', async () => {
    const wrapper = await mountSuspended(CatalogToolbar, {
      props: { filters: filters({ q: 'rouge', minPrice: 5 }), categories },
    })
    const form = wrapper.find('form')
    expect(form.attributes('method')).toBe('get')
    expect(form.attributes('action')).toBe('/produits')
    expect(wrapper.find('input[type="hidden"][name="q"]').attributes('value')).toBe('rouge')
    expect(wrapper.find('input[type="hidden"][name="minPrice"]').attributes('value')).toBe('5')
    expect(wrapper.find('input[name="maxPrice"]').exists()).toBe(false)
    expect(wrapper.find('#filter-sort').attributes('name')).toBe('sort')
  })
})
