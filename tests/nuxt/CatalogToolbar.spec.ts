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
      [
        {
          category: 'smartphones',
          sortBy: 'rating',
          order: 'desc',
          minPrice: null,
          maxPrice: null,
        },
      ],
    ])
  })

  it('« Toutes les catégories » et « Pertinence » émettent l’absence de filtre', async () => {
    const wrapper = await mountSuspended(CatalogToolbar, {
      props: { filters: filters({ category: 'beauty', sortBy: 'title' }), categories },
    })
    await wrapper.find('#filter-category').setValue('')
    await wrapper.find('#filter-sort').setValue('relevance')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('apply')?.[0]).toEqual([
      { category: null, sortBy: null, order: 'asc', minPrice: null, maxPrice: null },
    ])
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

  it('sans JavaScript : formulaire GET vers /produits, recherche conservée, prix en vrais champs', async () => {
    const wrapper = await mountSuspended(CatalogToolbar, {
      props: { filters: filters({ q: 'rouge', minPrice: 5 }), categories },
    })
    const form = wrapper.find('form')
    expect(form.attributes('method')).toBe('get')
    expect(form.attributes('action')).toBe('/produits')
    expect(wrapper.find('input[type="hidden"][name="q"]').attributes('value')).toBe('rouge')
    expect(wrapper.find('#filter-min-price').attributes('name')).toBe('minPrice')
    expect(wrapper.find('#filter-max-price').attributes('name')).toBe('maxPrice')
    expect(wrapper.find('input[type="hidden"][name="minPrice"]').exists()).toBe(false)
    expect(wrapper.find('#filter-sort').attributes('name')).toBe('sort')
  })

  describe('prix (#5)', () => {
    it('champs reliés à leur label, pré-remplis depuis l’URL avec la virgule', async () => {
      const wrapper = await mountSuspended(CatalogToolbar, {
        props: { filters: filters({ minPrice: 10.5 }), categories },
      })
      expect(wrapper.find('label[for="filter-min-price"]').exists()).toBe(true)
      expect(wrapper.find('label[for="filter-max-price"]').exists()).toBe(true)
      expect(wrapper.find('fieldset legend').text()).toBe('Prix (€)')
      expect(wrapper.find<HTMLInputElement>('#filter-min-price').element.value).toBe('10,5')
      expect(wrapper.find<HTMLInputElement>('#filter-max-price').element.value).toBe('')
    })

    it('« Appliquer » émet les bornes, virgule acceptée, vide = pas de borne', async () => {
      const wrapper = await mountSuspended(CatalogToolbar, {
        props: { filters: filters(), categories },
      })
      await wrapper.find('#filter-min-price').setValue('9,99')
      await wrapper.find('form').trigger('submit')
      expect(wrapper.emitted('apply')?.[0]?.[0]).toMatchObject({ minPrice: 9.99, maxPrice: null })
    })

    it('bornes inversées : remises dans l’ordre', async () => {
      const wrapper = await mountSuspended(CatalogToolbar, {
        props: { filters: filters(), categories },
      })
      await wrapper.find('#filter-min-price').setValue('50')
      await wrapper.find('#filter-max-price').setValue('10')
      await wrapper.find('form').trigger('submit')
      expect(wrapper.emitted('apply')?.[0]?.[0]).toMatchObject({ minPrice: 10, maxPrice: 50 })
    })

    it('saisie invalide : rien n’est émis, erreur annoncée et reliée au champ', async () => {
      const wrapper = await mountSuspended(CatalogToolbar, {
        props: { filters: filters(), categories },
        attachTo: document.body,
      })
      await wrapper.find('#filter-max-price').setValue('abc')
      await wrapper.find('form').trigger('submit')

      expect(wrapper.emitted('apply')).toBeUndefined()
      const input = wrapper.find('#filter-max-price')
      expect(input.attributes('aria-invalid')).toBe('true')
      expect(input.attributes('aria-describedby')).toBe('filter-max-price-error')
      expect(wrapper.find('#filter-max-price-error').attributes('role')).toBe('alert')
      expect(document.activeElement).toBe(input.element)
      wrapper.unmount()
    })

    it('l’URL change (bouton retour) : les champs et les erreurs suivent', async () => {
      const wrapper = await mountSuspended(CatalogToolbar, {
        props: { filters: filters(), categories },
      })
      await wrapper.find('#filter-min-price').setValue('-1')
      await wrapper.find('form').trigger('submit')
      await wrapper.setProps({ filters: filters({ minPrice: 20, maxPrice: 30 }) })

      expect(wrapper.find<HTMLInputElement>('#filter-min-price').element.value).toBe('20')
      expect(wrapper.find<HTMLInputElement>('#filter-max-price').element.value).toBe('30')
      expect(wrapper.find('#filter-min-price-error').exists()).toBe(false)
    })
  })
})
