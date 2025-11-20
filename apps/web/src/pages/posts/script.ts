// Client-side script for posts page
const itemsPerPage = 20

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('[role="tab"]')
    const articles = document.querySelectorAll('.article-item') as NodeListOf<HTMLElement>
    const paginationContainer = document.querySelector('.pagination')
    const noArticlesMessage = document.querySelector('.no-articles-message')
    const articleList = document.querySelector('.news__list')

    let selectedCategory = 'ALL'
    let currentPage = 1

    function updateView() {
      const filteredArticles = Array.from(articles).filter(
        (article) => selectedCategory === 'ALL' || article.dataset.category === selectedCategory
      )

      const totalPages = Math.ceil(filteredArticles.length / itemsPerPage)
      if (currentPage > totalPages) {
        currentPage = 1
      }

      // Article visibility and message handling
      if (filteredArticles.length === 0) {
        articleList.style.display = 'none'
        noArticlesMessage.style.display = 'block'
      } else {
        articleList.style.display = 'block'
        noArticlesMessage.style.display = 'none'
      }

      articles.forEach((article) => {
        article.style.display = 'none'
      })
      const startIndex = (currentPage - 1) * itemsPerPage
      const endIndex = startIndex + itemsPerPage
      filteredArticles.slice(startIndex, endIndex).forEach((article) => {
        article.style.display = 'list-item'
      })

      // Pagination
      paginationContainer.innerHTML = ''
      if (totalPages > 1) {
        const prevButton = document.createElement('button')
        prevButton.className = 'pagination-arrow prev'
        prevButton.setAttribute('aria-label', '前のページ')
        prevButton.innerHTML = '<'
        prevButton.disabled = currentPage === 1
        prevButton.addEventListener('click', () => {
          if (currentPage > 1) {
            currentPage--
            updateView()
          }
        })
        paginationContainer.appendChild(prevButton)

        for (let i = 1; i <= totalPages; i++) {
          const pageButton = document.createElement('button')
          pageButton.textContent = i
          if (currentPage === i) {
            pageButton.classList.add('active')
          }
          pageButton.addEventListener('click', () => {
            currentPage = i
            updateView()
          })
          paginationContainer.appendChild(pageButton)
        }

        const nextButton = document.createElement('button')
        nextButton.className = 'pagination-arrow next'
        nextButton.setAttribute('aria-label', '次のページ')
        nextButton.innerHTML = '>'
        nextButton.disabled = currentPage === totalPages
        nextButton.addEventListener('click', () => {
          if (currentPage < totalPages) {
            currentPage++
            updateView()
          }
        })
        paginationContainer.appendChild(nextButton)
      }
    }

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        tabs.forEach((t) => t.setAttribute('aria-selected', 'false'))
        tab.setAttribute('aria-selected', 'true')
        selectedCategory = tab.dataset.category
        currentPage = 1
        updateView()
      })
    })

    // Initial view setup
    updateView()
  })
}
