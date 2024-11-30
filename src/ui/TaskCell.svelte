<script lang="ts">
    export let handleClick: (e: any) => void = () => {};
    
    function internalHandleClick(e: any) {
        if (!e.target.closest('.no-cell-click')) {
            handleClick(e);
        }
    }   
</script>
  
<td on:click={internalHandleClick}>
    <slot class="full-width-height"></slot>
</td>

<style>
    .full-width-height {
        width: 100%;
        height: 100%;
    }
</style>